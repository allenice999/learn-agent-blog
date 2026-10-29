# OpenAI SDK调用问题

## stream = await client.responses.create中的stream是什么对象呀？

`stream = await client.responses.create(..., stream=True)` 得到的不是完整响应，也不是原始字符串，而是 OpenAI SDK 的：

```text
AsyncStream[ResponseStreamEvent]
```

它是一层“异步流包装器”。

### stream 对象是什么

它有两条重要通道：

- `stream` 本身提供事件迭代能力。
- `stream.response` 是底层的 `httpx.Response`，保存 HTTP 状态码、Header 等请求信息。

底层关系可以理解为：

```text
HTTP 响应体
   ↓ 原始 SSE 字节流
httpx.Response
   ↓ SDK 解码、JSON 解析、类型转换
AsyncStream
   ↓ async for
ResponseStreamEvent 对象
```

SDK 负责处理这些底层工作：

- 从网络接收字节。
- 按 SSE 协议寻找事件边界。
- 处理 `data:` 字段。
- 将 JSON 转换成具体的 Pydantic 模型。
- 把 `event.type` 识别为 `response.output_text.delta`、`response.completed` 等。

如果一条 SSE 消息被拆成多个 TCP 数据块，SDK 会等待并拼接；如果一个网络块里包含多个 SSE 消息，SDK 会分别产出事件。


## 使用async for event in stream进行遍历是上面效果？

### async for 的实际效果

```python
async for event in stream:
    ...
```

每次循环会调用 `AsyncStream.__anext__()`，效果是：

1. 检查 SDK 是否已经解析出下一个完整事件。
2. 如果没有，就继续从 HTTP 响应读取数据。
3. 网络等待期间，把控制权交还给事件循环，不会阻塞整个 FastAPI 服务。
4. 获得一个完整的、类型化的事件对象。
5. 循环体处理该事件。
6. 再次等待下一个事件。

因此你收到的不是一大段文本，而是一系列对象，例如：

```text
ResponseCreatedEvent
ResponseInProgressEvent
ResponseOutputTextDeltaEvent
...
ResponseCompletedEvent
```

文字通常是这样到达的：

```text
event.delta = "Python"
event.delta = " 中的"
event.delta = "装饰器"
```

注意 `async for` 不是“每次一个字符”，也不是严格“每次一个 token”。一个 delta 的大小由上游决定，可能包含多个 token。

这个流还是一次性消费的：

- 不能当成列表随机访问。
- 不能遍历两次。
- 一旦读取，数据就从网络流中消耗掉了。

## StreamingResponse 是什么

FastAPI 的 `StreamingResponse` 是 Starlette 提供的通用流式 HTTP 响应。

它接收两类内容：

- 异步可迭代对象，例如 `async def` 生成的异步生成器。
- 同步可迭代对象，此时 Starlette 会包装到线程池中执行。

你的代码属于前者：

```python
return StreamingResponse(
    stream_answer(stream),
    media_type="text/event-stream",
)
```

`stream_answer(stream)` 是一个异步生成器。每次它执行 `yield`，`StreamingResponse` 就得到一个字符串或字节块。

按照你当前安装的 Starlette 实现，它大致执行以下步骤：

1. 先发送 HTTP 响应状态和 Header。
2. 遍历异步生成器。
3. 将一个字符串编码成 UTF-8 字节。
4. 立即把该字节块发送给浏览器，并标记 `more_body=True`。
5. 等待生成器产生下一块。
6. 生成器结束后，发送空 body 和 `more_body=False`。

所以响应过程是：

```text
yield delta 1  → 浏览器收到 delta 1
yield delta 2  → 浏览器收到 delta 2
yield done     → 浏览器收到 done
生成器结束      → HTTP 响应结束
```

`StreamingResponse` 本身并不知道什么是 SSE。它只是一个通用的“不断发送数据块”的响应类。SSE 格式仍然需要你的代码自己生成：

```text
event: delta
data: {"text":"..."}

```

其中最后的空行是 SSE 事件边界。

## 整个链路

你的系统实际上有两层流：

```text
DeepSeek/LLM
   │ 原始 SSE
   ▼
OpenAI SDK 的 AsyncStream
   │ 类型化事件对象
   ▼
你的 stream_answer 异步生成器
   │ 自定义 SSE 字符串
   ▼
StreamingResponse
   │ ASGI 数据块
   ▼
浏览器
```

需要特别注意：`StreamingResponse` 一开始就会把 HTTP 状态码和 Header 发送出去。之后即使上游 LLM 报错，也无法再把 FastAPI 的 HTTP 状态从 200 改为 502，只能继续发送一个 SSE `error` 事件。

官方文档也说明，Responses API 使用 SSE，并且 SDK 返回的事件是带类型的对象，可以通过 `event.type` 区分不同事件：[OpenAI Streaming API responses](https://developers.openai.com/api/docs/guides/streaming-responses)。