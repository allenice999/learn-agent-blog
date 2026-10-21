# FastMCP stdio 模式下 `Connection closed` 问题排查文档

## 一、问题概述

在 Windows + Conda 环境下使用 FastMCP 开发 MCP 服务器时，出现以下现象：

- 手动运行 `python server.py` 可以正常启动，终端显示 `INFO Starting MCP server 'MyFirstMCPServer' with transport 'stdio'`
- 但通过 `fastmcp list server.py` 连接时报 `Error: Connection closed`
- 通过自定义客户端（`StdioTransport` 启动子进程）连接时报 `MCPError: Connection closed`
- Codex 能识别到 MCP 服务器，但识别不到 tools

## 二、根因

**FastMCP 启动时默认在 stdout 打印 banner，污染了 stdio 传输的 JSON-RPC 协议通道。**

stdio 传输模式下，服务器的 stdout 是 MCP 协议专用通道，客户端会逐行严格解析 JSON-RPC 消息。FastMCP 默认输出的 banner（ASCII 艺术字、版本号、服务器名、传输方式等信息）属于非 JSON 文本，客户端解析失败后判定连接断开，抛出 `Connection closed`。

手动运行 `python server.py` 时没有客户端在严格解析 stdout，所以看起来“正常启动”，掩盖了问题。

## 三、解决方案

在 `server.py` 中调用 `mcp.run()` 时关闭 banner：

```python
mcp.run(show_banner=False)
```

## 四、完整可用的服务器模板

```python
import os
os.environ["FASTMCP_CHECK_FOR_UPDATES"] = "off"  # 避免启动时联网检查版本（Windows SSL 证书问题）

from fastmcp import FastMCP

mcp = FastMCP("MyServer")

@mcp.tool
def greet(name: str) -> str:
    """向指定的人打招呼。"""
    return f"Hello, {name}!"

if __name__ == "__main__":
    mcp.run(show_banner=False)  # stdio 模式必须关闭 banner
```

## 五、配套排查经验

### 1. 禁用版本检查

FastMCP 启动时默认联网检查 PyPI 新版本。Windows 下底层 `httpx2` 加载 OpenSSL 默认证书路径（`C:\Program Files\Common Files\ssl\cert.pem`）失败，会抛 `FileNotFoundError`。在 `import fastmcp` 之前设置：

```python
os.environ["FASTMCP_CHECK_FOR_UPDATES"] = "off"
```

注意正确的变量名是 `FASTMCP_CHECK_FOR_UPDATES`，不是 `FASTMCP_DISABLE_VERSION_CHECK`。

### 2. stdio 模式下 stdout 只留给协议

**任何调试输出都必须走 stderr**，例如：

```python
import sys
print("调试信息", file=sys.stderr)
```

不要用裸 `print()`，否则会再次污染协议通道，导致 `Connection closed`。

### 3. 子进程启动时显式指定解释器和工作目录

当客户端以子进程方式启动服务器时，不会继承终端里 `conda activate` 后的环境。需要显式指定 Conda 环境的 Python 绝对路径和脚本所在目录：

```python
from fastmcp.client.transports import StdioTransport

transport = StdioTransport(
    command=r"D:\software\miniconda3\envs\fastmcp\python.exe",
    args=[r"D:\projects\devPilot\mcp\server.py"],
    cwd=r"D:\projects\devPilot\mcp",
)
```

### 4. Windows 事件循环策略（备用）

如果上述修复后仍偶发连接问题，可在 `server.py` 最顶部切换事件循环策略：

```python
import asyncio
asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
```

### 5. 用内存传输快速验证服务器健康

当子进程启动链路反复出问题时，绕过子进程直接确认服务器逻辑是否正常：

```python
import asyncio
from fastmcp import Client
from server import mcp

async def main():
    client = Client(mcp)
    async with client:
        tools = await client.list_tools()
        print("工具：", [t.name for t in tools])

asyncio.run(main())
```

能打印出工具列表，就证明服务器和工具注册没问题，问题在子进程启动层。

## 六、问题定位路径回顾

| 现象 | 初步判断 | 实际原因 |
|---|---|---|
| 启动时 `FileNotFoundError` | SSL 证书缺失 | 版本检查联网 + Windows 证书路径不存在 |
| `fastmcp list` 报 `Connection closed` | 路径或 Python 环境错误 | banner 污染 stdout |
| Codex 识别不到 tools | Codex 工具注入缺陷 | banner 污染 stdout，握手阶段失败 |
| 手动运行看似正常 | 以为服务器已就绪 | 无客户端解析 stdout，banner 不影响观感 |

## 七、关键结论

1. **stdio 模式下 `show_banner=False` 是必须的**，否则 banner 会破坏 JSON-RPC 协议流。
2. **stdio 服务器的 stdout 只能输出协议消息**，所有调试信息走 stderr。
3. **Windows + Conda 环境下要显式指定 Python 解释器路径**，不能依赖 PATH 继承。
4. **禁用版本检查可以规避 Windows SSL 证书路径问题**。
5. 遇到 `Connection closed` 时，优先检查 stdout 是否有非协议输出，再用内存传输确认服务器本身是否健康。