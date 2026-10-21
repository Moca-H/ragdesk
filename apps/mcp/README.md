# ragdesk-mcp

把本机 [ragdesk](https://github.com/Moca-H/ragdesk) 知识库暴露成 **MCP 工具**，供 Cursor、Claude Desktop、DeepSeek Harness 等 Agent 调用。

PyPI：https://pypi.org/project/ragdesk-mcp/

## 什么时候用 MCP / 什么时候不用

| 场景 | 怎么用 |
|------|--------|
| 浏览器里上传文档、对话 | **不用 MCP**，跑 Web 即可 |
| 后端 / 脚本联调 | **不用 MCP**，直接调 HTTP API |
| Cursor / Claude / DeepSeek Harness 等 AI 要查你的知识库 | **用 MCP**（本包） |

MCP 只是一层「工具协议」；真正的检索与问答仍由 ragdesk API 完成。

## 前提

1. 本机（或内网）已启动 ragdesk API，例如：
   - `npm run dev` → API 默认 `http://127.0.0.1:8000`
   - 或 `docker compose up --build` → 按部署地址填写
2. 安装 [`uv`](https://github.com/astral-sh/uv)（推荐，用 `uvx`）或 Python 3.11+

## 安装

```bash
# 推荐：按需拉取，不污染全局环境
uvx ragdesk-mcp

# 或
pip install ragdesk-mcp
ragdesk-mcp
```

## 环境变量

| 变量 | 默认 | 含义 |
|------|------|------|
| `RAGDESK_API_BASE` | `http://127.0.0.1:8000` | ragdesk API 根地址 |
| `RAGDESK_KB` | `default` | 默认知识库 id |
| `RAGDESK_API_TOKEN` | _(空)_ | 可选，`Authorization: Bearer …` |

## 提供的工具

| 工具 | 作用 |
|------|------|
| `ragdesk_health` | 检测 API 是否可达 |
| `list_knowledge_bases` | 列出知识库 |
| `list_documents` | 列出某知识库文档 |
| `ingest_text` | 把文本/Markdown 入库 |
| `import_sample` | 导入内置示例文档 |
| `ask` | 问答（`rag` / `agent`），返回回答与引用 |

---

## 各客户端配置

以下均假设 API 在 `http://127.0.0.1:8000`。换机器或 Docker 时只改 `RAGDESK_API_BASE`。

### 1. Cursor

编辑 Cursor MCP 配置（Settings → MCP，或项目/用户级 `mcp.json`）：

```json
{
  "mcpServers": {
    "ragdesk": {
      "command": "uvx",
      "args": ["ragdesk-mcp"],
      "env": {
        "RAGDESK_API_BASE": "http://127.0.0.1:8000",
        "RAGDESK_KB": "default"
      }
    }
  }
}
```

本地开发（未发 PyPI / 改源码时）：

```json
{
  "mcpServers": {
    "ragdesk": {
      "command": "python",
      "args": ["-m", "ragdesk_mcp.server"],
      "cwd": "/绝对路径/ragdesk/apps/mcp",
      "env": {
        "PYTHONPATH": "/绝对路径/ragdesk/apps/mcp/src",
        "RAGDESK_API_BASE": "http://127.0.0.1:8000"
      }
    }
  }
}
```

### 2. Claude Desktop

编辑 Claude Desktop 配置文件（macOS：`~/Library/Application Support/Claude/claude_desktop_config.json`；Windows：`%APPDATA%\Claude\claude_desktop_config.json`）：

```json
{
  "mcpServers": {
    "ragdesk": {
      "command": "uvx",
      "args": ["ragdesk-mcp"],
      "env": {
        "RAGDESK_API_BASE": "http://127.0.0.1:8000",
        "RAGDESK_KB": "default"
      }
    }
  }
}
```

保存后重启 Claude Desktop。

### 3. DeepSeek Harness

Harness 通过插件 `@deepseek-ai/dsh-mcp-client` 连接 MCP。在 profile 的 patch 配置里增加一条（路径以你本机 harness 文档为准，常见为 `~/.dsh/profiles/.../cordis.patch.yml`）：

```yaml
- insert:
    - id: mcp-ragdesk
      name: '@deepseek-ai/dsh-mcp-client'
      config:
        serverName: ragdesk
        transport: stdio
        command: uvx
        args: ['ragdesk-mcp']
        env:
          RAGDESK_API_BASE: http://127.0.0.1:8000
          RAGDESK_KB: default
```

重启 harness 后，工具一般以 `mcp__ragdesk__ask` 等形式出现。细节见 [DeepSeek Harness MCP 说明](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/mcp)。

### 4. 其他支持 MCP 的客户端

凡支持 **MCP stdio** 的客户端（如部分 VS Code / Copilot MCP、Windsurf、Cline、Continue 等），配置模式相同：

- **command**：`uvx`（或 `ragdesk-mcp`）
- **args**：`["ragdesk-mcp"]`（若 command 已是 `ragdesk-mcp` 则可省略）
- **env**：至少设置 `RAGDESK_API_BASE`

以各客户端自己的 MCP 配置 UI / JSON 为准。

### 5. 后端 / 脚本（不用 MCP）

业务代码、联调、自动化请直接调 HTTP，更简单：

```bash
# 健康检查
curl http://127.0.0.1:8000/api/health

# 提问（SSE）
curl -N -X POST http://127.0.0.1:8000/api/chat \
  -H "Content-Type: application/json" \
  -H "X-Ragdesk-KB: default" \
  -d '{"messages":[{"role":"user","content":"如何本地启动？"}],"top_k":4,"mode":"rag"}'
```

常用接口见仓库根目录 [README](../../README.md)「API 摘要」。请求头 `X-Ragdesk-KB` 指定知识库。

---

## 本地开发本包

```bash
cd apps/mcp
pip install -e .
ragdesk-mcp
```

## 维护者：发布到 PyPI

1. 修改 `pyproject.toml` / `__init__.py` 中的 `version`
2. 打标签并推送（需仓库 Secret `PYPI_API_TOKEN`）：

```bash
git tag ragdesk-mcp-v0.1.2
git push origin ragdesk-mcp-v0.1.2
```

终端用户**不需要** Token，安装用 `uvx ragdesk-mcp` 或 `pip install ragdesk-mcp` 即可。
