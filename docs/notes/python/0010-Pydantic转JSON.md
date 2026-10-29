想查看LLM的SSE数据中的usage信息（event.response.usage），但是这个对象是ResponseUsage类型，不能直接json.dump()。

可以使用`model_dump()`转化为可json序列化的对象。 `model_dump()`来自 **Pydantic v2 的 `BaseModel`**，不是 OpenAI SDK 单独实现的方法。

你当前环境中的继承关系是：

```text
ResponseUsage
    -> openai.BaseModel
        -> pydantic.BaseModel
            -> object
```

因此 `ResponseUsage` 可以使用：

- `model_dump()`：转换成普通 `dict`，嵌套模型也会递归转换
- `model_dump_json()`：直接返回 JSON 字符串
- `model_fields`：查看字段定义
- `model_validate()`：从字典构造并验证模型

其中 `model_dump()` 的实际定义在 Pydantic 的 `BaseModel.model_dump` 中，OpenAI 的 `BaseModel` 继承并沿用了它。

所以：

```python
usage_data = event.response.usage.model_dump()
```

之后得到的 `usage_data` 才是 `json.dumps()` 能序列化的普通 Python 字典。

旧写法 `.dict()` 也存在，但在 Pydantic v2 中已经属于旧接口，新代码应优先使用 `model_dump()`。

OpenAI 官方文档也说明 SDK 返回的是类型化对象，这正是这里需要通过 Pydantic 方法转换的原因：[Streaming API responses](https://developers.openai.com/api/docs/guides/streaming-responses)。