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

- 多知识库隔离、只读知识库、ZIP 导入/导出
- 上传进度（解析 / 切分 / 向量化）与可读错误；入库失败可重试日志
- 拖拽上传、选文件夹、粘贴文本 / URL 入库、示例一键导入、批量删除、重建索引
- 监视文件夹（服务端轮询本机目录自动入库）
- 混合检索（向量 + BM25）；Agent 模式展示改写 query；引用定位到片段
- 对话停止 / 重试、本地历史、只读分享链接
- API Token（`RAGDESK_API_TOKEN`）与环境变量锁定设置（`RAGDESK_LOCK_SETTINGS`）
- Provider 连通检测、健康面板、评测打分
- CLI / 系统托盘快捷提问（可选）
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

## 安全与预配（可选）

| 环境变量 | 作用 |
|----------|------|
| `RAGDESK_API_TOKEN` | 启用后除 `/api/health` 外需 `Authorization: Bearer …` |
| `RAGDESK_LOCK_SETTINGS` | 设为 `1`/`true` 时禁止网页改 Provider / 模型 |
| `RAGDESK_*` Provider 相关 | 可在服务端预配 base_url / model / key（见 `apps/api`） |

网页「设置」里可保存客户端 Token；健康页可查看是否启用。

## API 摘要

- `GET/POST /api/kbs` · `PATCH /api/kbs/{id}/readonly` · `GET …/export` · `POST /api/kbs/import`
- `GET/PUT /api/settings`
- `GET/PUT /api/watch`
- `GET /api/health` · `GET /api/health/detail`
- `GET /api/provider/status`
- `POST /api/documents/upload-stream`（SSE）· `POST /api/documents/text` · `POST /api/documents/url`
- `POST /api/documents/sample` · `POST /api/documents/reindex` · `POST /api/documents/delete-batch`
- `POST /api/chat`（SSE，`mode=rag|agent`）

请求头 `X-Ragdesk-KB` 指定知识库（默认 `default`）。若配置了 Token，再加 `Authorization: Bearer <token>`。

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

## CLI / 托盘（可选）

```powershell
# 健康检查 / 入库 / 提问
python apps/cli/ragdesk_cli.py health
python apps/cli/ragdesk_cli.py ingest .\README.md
python apps/cli/ragdesk_cli.py ask "这个项目是做什么的？"

# 系统托盘（需 pystray + pillow）
pip install pystray pillow
python apps/tray/ragdesk_tray.py
```

环境变量：`RAGDESK_API_BASE`、`RAGDESK_KB`、`RAGDESK_API_TOKEN`、`RAGDESK_WEB_URL`。

## 目录

```
apps/
  api/   FastAPI + Chroma + Providers
  web/   React 工作台
  mcp/   MCP server（PyPI: ragdesk-mcp）
  cli/   命令行 ask / ingest / health
  tray/  轻量系统托盘快捷提问
scripts/dev.ps1
docker-compose.yml
```

## License

MIT

---

## English

Self-hosted RAG desk with multi knowledge bases (export/import, readonly), folder watch, paste/URL ingest, API token + locked settings, hybrid retrieval, agent rewrite display, health/eval panels, CLI/tray helpers, one-click local/Docker startup, and optional MCP (`ragdesk-mcp`). See `apps/mcp/README.md`.
