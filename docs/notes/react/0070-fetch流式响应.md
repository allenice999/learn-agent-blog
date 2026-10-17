# 浏览器如何用 fetch 流式读响应（概念）

本文是**概念铺垫**，核心一句话：**`fetch` 返回的 `response.body` 是一个 `ReadableStream`，你可以一段一段地读，而不是等整个响应结束。**

## 1 先理解“流式”解决什么问题

普通 `fetch` 的模型是：**发请求 → 服务器算完 → 一次性返回全部 → 你拿到完整 body**。

```js
const res = await fetch("/api/chat");
const text = await res.text();   // 必须等服务器把全部内容生成完
```

问题：如果服务器要 10 秒才生成完内容（比如大模型逐字输出），用户要**干等 10 秒**才看到第一个字。

**流式**的模型是：**服务器边生成边发，浏览器边收边处理**。

```
时间轴：
普通：  [等待 10s............] → 一次性显示全部
流式：  [第1字][第2字][第3字]... → 边收边显示
```

用户 0.2 秒就看到第一个字，体验完全不同。

## 2 `response.body` 是什么

`fetch` 的响应对象 `Response` 有两个读 body 的方式：

| 方式 | 特点 |
|------|------|
| `res.text()` / `res.json()` / `res.blob()` | **一次性读完**，等全部到齐 |
| `res.body` | **流**（`ReadableStream`），可以一段一段读 |

`res.body` 是一个 **`ReadableStream`**——Web 标准的流对象。它像一根水管，数据从服务器那头流过来，你在这头**按 chunk（块）读取**。

```
服务器 ──chunk1──chunk2──chunk3──▶ 浏览器
                                    │
                              res.body 可读流
                                    │
                              你逐个 chunk 读
```

**关键**：`res.body` 是**字节流**（`Uint8Array`），不是字符串。要转成文本，得用 `TextDecoder` 解码。

## 3 读取流的标准三步

```js
// 1. 拿到流
const res = await fetch("/api/stream");
const reader = res.body.getReader();   // 获取读取器

// 2. 循环读 chunk
const decoder = new TextDecoder();     // 字节 → 字符串

while (true) {
  const { done, value } = await reader.read();

  if (done) break;                     // 流结束

  const text = decoder.decode(value, { stream: true });  // 解码这块
  console.log("收到一块：", text);
  // 在这里把 text 追加到界面
}

// 3. （可选）收尾，把 decoder 里残留的字节冲出来
console.log(decoder.decode());         // stream: false，冲尾
```

### 三个关键点

1. **`reader.read()` 返回 `{ done, value }`**
   - `done: true` 表示流结束
   - `value` 是 `Uint8Array`（这一块的字节）

2. **`TextDecoder` 的 `{ stream: true }` 很重要**
   - 一个中文字符在 UTF-8 里占 3 字节，可能被切在两个 chunk 之间
   - `stream: true` 让 decoder **保留不完整的字节**，等下一块拼上再解码
   - 不加的话，跨块的汉字会变成乱码 `�`

3. **循环结束要 `decoder.decode()` 冲尾**
   - 把 decoder 内部残留的半个字符冲出来（通常为空，但严谨起见要调）

## 4 为什么是字节流而不是文本流

因为 HTTP 传输的是**字节**，不是字符。一块 chunk 的大小是服务器/网络决定的，**不保证在字符边界切开**。

```
假设服务器发 "你好"，UTF-8 编码是 6 个字节：
  E4 BD A0  E5 A5 BD
  └─你──┘  └─好──┘

chunk 可能这样切：
  chunk1 = E4 BD A0 E5   ← "你"完整 + "好"的第1字节
  chunk2 = A5 BD         ← "好"的剩余2字节

第一块解码时，"好"不完整 → decoder 暂存 E5
第二块拼上 → 才能解出"好"
```

`{ stream: true }` 就是让 decoder 干这个"暂存 + 拼接"的活。

## 5 两种常见的流格式

### 格式 A：纯文本流（最简单）

服务器直接发纯文本，浏览器逐块拼接显示：

```js
let full = "";
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  full += decoder.decode(value, { stream: true });
  outputEl.textContent = full;   // 实时更新界面
}
```

适合：简单的逐字输出、日志流。

### 格式 B：SSE（Server-Sent Events，更常见）

大模型 API（OpenAI 等）通常用 **SSE**：每块数据是 `data: {...}\n\n` 格式的文本行。

```
data: {"token":"你"}

data: {"token":"好"}

data: [DONE]
```

读取时要**按行分割**，每行去掉 `data: ` 前缀再 `JSON.parse`：

```js
const decoder = new TextDecoder();
let buffer = "";

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  buffer += decoder.decode(value, { stream: true });

  // 按行处理
  const lines = buffer.split("\n");
  buffer = lines.pop();   // 最后一行可能不完整，留到下次

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;

    const data = trimmed.slice(5).trim();   // 去掉 "data:"
    if (data === "[DONE]") return;           // 结束标记
    const json = JSON.parse(data);
    // 处理 json.token
  }
}
```

**注意**：这里又出现了"缓冲 + 拼接"的思路——和 `TextDecoder` 的 `stream: true` 是同一个道理：**网络切块不保证在语义边界（行/字符）上**。

## 6 完整最小示例（概念验证）

**服务端**（Route Handler 流式返回）：

```ts
// app/api/stream/route.ts
export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const words = ["你", "好", "，", "世", "界"];
      for (const w of words) {
        controller.enqueue(encoder.encode(w));   // 每次发一块
        await new Promise(r => setTimeout(r, 300)); // 模拟逐步生成
      }
      controller.close();                        // 结束
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
```

**客户端**（流式读）：

```js
async function readStream() {
  const res = await fetch("/api/stream");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
    console.log("当前累计：", text);
  }
}
```

你会看到控制台**每隔 300ms 打印一次**逐渐变长的文本，而不是等 1.5 秒一次性出现——这就是流式。

## 7 概念要点总结

| 概念 | 说明 |
|------|------|
| `res.body` | `ReadableStream`，可逐块读 |
| `getReader()` | 拿到读取器 |
| `reader.read()` | 返回 `{ done, value }`，`value` 是 `Uint8Array` |
| `TextDecoder` | 字节 → 字符串 |
| `{ stream: true }` | 处理跨块的多字节字符，防乱码 |
| 循环 + `done` | 读到 `done: true` 结束 |
| 冲尾 `decode()` | 清掉 decoder 残留 |
| SSE | 一种文本流格式，按行解析 `data:` 前缀 |
| 缓冲拼接 | 网络切块不保证语义边界，要自己缓冲 |

## 8 和前面文章的连接

流式读响应，本质是**客户端**的事，所以它一定发生在 **Client Component** 里——需要 `"use client"`，因为要用 `fetch` + 循环更新界面（可能需要 `useState` 展示）。

而**产生流**的一侧，就是 **Route Handler** 返回一个 `ReadableStream`（如上面的例子）。

所以 W2 落地时的典型链路是：

```
Client Component（"use client"）
  → fetch("/api/stream")
    → Route Handler（route.ts）返回 ReadableStream
      → 客户端 res.body.getReader() 逐块读
        → setState 更新界面，实现逐字显示
```

## 🏋️ 概念题

**题 1**：为什么 `res.body` 读出来的是 `Uint8Array` 而不是字符串？

答案

HTTP 传输的是字节流，不是字符流。一块 chunk 的大小由服务器/网络决定，可能在任意字节处切断，甚至切断一个多字节字符。所以底层是字节，需要 `TextDecoder` 按 UTF-8 解码成字符串。

**题 2**：`decoder.decode(value, { stream: true })` 里的 `stream: true` 如果去掉会怎样？

答案

如果一个多字节字符（如中文）被切在两个 chunk 之间，第一块解码时这个字符不完整，会输出替换字符 `�`；第二块又从头解，导致乱码。`stream: true` 让 decoder 保留不完整字节，跨块拼接后再解码。

**题 3**：为什么 SSE 解析要维护一个 `buffer`？

答案

因为网络切块不保证在行边界（`\n`）上。一个 `data: {...}` 行可能被切成两块，第一块不完整。`buffer` 把不完整的尾部留到下次，和新的数据拼起来再按行解析。这和 `TextDecoder` 的 `stream: true` 是同一个思路。

**题 4**：流式读的代码应该放在 Server Component 还是 Client Component？为什么？

答案

Client Component（`"use client"`）。因为要用 `fetch` 在浏览器发起请求、用 `getReader()` 读流、并实时更新界面（需要 `useState`）。Server Component 在服务端执行，不走浏览器的 fetch 流。


## 记忆卡

> **`res.body` 是可读流 → `getReader()` 拿读取器 → `read()` 得 `{done, value}` → `TextDecoder` 解码（带 `stream: true`）→ 循环到 `done` → 冲尾。**
> **SSE 再加一层：按行缓冲、去 `data:` 前缀、`JSON.parse`。**
