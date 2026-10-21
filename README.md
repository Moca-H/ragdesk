# ragdesk

可切换 Provider 的**本地知识库问答**（RAG）。

上传 Markdown / TXT / PDF / Word（.docx）/ Excel（.xlsx）→ 切分向量化 → 对话，并展示检索引用。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

```text
┌────────────┐     ┌──────────────────────────────┐
│  React UI  │────▶│  FastAPI  ·  Chroma  · LLM   │
│  资料/对话  │◀────│  mock / OpenAI兼容 / Ollama  │
└────────────┘     └──────────────────────────────┘
```

## 功能概览

- 多知识库隔离
- 上传进度（解析 / 切分 / 向量化）与可读错误
- 拖拽上传、示例一键导入、重建索引
- 混合检索（向量 + BM25）
- Agent 模式（先改写问题再检索）
- 对话停止 / 重试、本地历史、只读分享链接
- Provider 连通检测与模型建议
- 评测小面板
- Windows 一键启动 / Docker Compose

## 快速开始（Windows 一键）

```powershell
.\dev.cmd
```

或：

```powershell
npm run dev
```

页面：http://127.0.0.1:5173  

默认 Provider 为 **mock**，无需 Key。

### Docker

```bash
docker compose up --build
```

打开 http://127.0.0.1:8080  

## 切换真实模型

在「设置」页配置 Provider，点「检测连通」：

| Provider | Base URL 示例 | Chat / Embedding 示例 |
|----------|---------------|------------------------|
| openai_compat | `https://api.openai.com/v1` | `gpt-4o-mini` / `text-embedding-3-small` |
| ollama | `http://127.0.0.1:11434` | `llama3.2` / `nomic-embed-text` |

更换 Embedding 后请在资料库点「重建索引」。

## API 摘要

- `GET/POST /api/kbs`
- `GET/PUT /api/settings`
- `GET /api/provider/status`
- `POST /api/documents/upload-stream`（SSE 进度）
- `POST /api/documents/sample`
- `POST /api/documents/reindex`
- `POST /api/chat`（SSE，`mode=rag|agent`）

请求头 `X-Ragdesk-KB` 指定知识库（默认 `default`）。

## MCP（可选）

把本机知识库提供给 AI 客户端用。包：[`ragdesk-mcp`](https://pypi.org/project/ragdesk-mcp/)（PyPI）。

| 你想做什么 | 要不要配 MCP |
|------------|----------------|
| 只用网页上传 / 对话 | 不需要 |
| 后端、脚本调接口 | 不需要，直接用下面「API 摘要」的 HTTP |
| Cursor / Claude Desktop / DeepSeek Harness 等 Agent 查库 | 需要 |

前提：API 已启动（`npm run dev` 或 Docker，默认 `http://127.0.0.1:8000`）。

### Cursor

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

### Claude Desktop

配置文件里同样加入上述 `mcpServers.ragdesk` 段（Windows：`%APPDATA%\Claude\claude_desktop_config.json`），保存后重启。

### DeepSeek Harness

使用官方 MCP 插件 `@deepseek-ai/dsh-mcp-client`，stdio 示例：

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

工具名形如 `mcp__ragdesk__ask`。

### 其他 MCP 客户端 / 后端

- 其他支持 MCP stdio 的 IDE / Agent：command=`uvx`，args=`["ragdesk-mcp"]`，并设置 `RAGDESK_API_BASE`。
- 后端业务代码请走 HTTP，不要绕 MCP。

完整说明（环境变量、工具列表、本地开发、发版）：[apps/mcp/README.md](apps/mcp/README.md)。

> 维护者发 MCP 新版：改版本号后打标签 `ragdesk-mcp-vX.Y.Z`；需仓库 Secret `PYPI_API_TOKEN`。

## 目录

```
apps/
  api/   FastAPI + Chroma + Providers
  web/   React 工作台
  mcp/   MCP server（PyPI: ragdesk-mcp）
scripts/dev.ps1
docker-compose.yml
```

## License

MIT

---

## English

Self-hosted RAG desk with multi knowledge bases, hybrid retrieval, agent rewrite mode, provider probing, eval panel, and one-click local/Docker startup.
