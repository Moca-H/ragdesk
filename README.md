# ragdesk

可切换 Provider 的**本地知识库问答**（RAG）。

上传 Markdown / TXT / PDF → 切分向量化 → 对话，并展示检索引用。

- **前端**：Vite + React + TypeScript  
- **后端**：FastAPI + Chroma  
- **Provider**：`mock`（开箱演示） / `openai_compat`（OpenAI、DeepSeek 等） / `ollama`

## 快速开始（Windows 一键）

在项目根目录执行任一方式：

```powershell
.\dev.cmd
```

或：

```powershell
npm run dev
```

或：

```powershell
.\scripts\dev.ps1
```

脚本会自动：

1. 准备 Python 虚拟环境 / 安装依赖（仅首次）
2. 安装前端依赖（仅首次）
3. 同时启动 API（8000）和 Web（5173）
4. 打开浏览器

页面：http://127.0.0.1:5173  

默认 Provider 为 **mock**，无需 Key 即可体验。

### 分开启动（可选）

```powershell
npm run dev:api
npm run dev:web
```

## 切换真实模型

在「设置」页：

| Provider | Base URL 示例 | Chat / Embedding 示例 |
|----------|---------------|------------------------|
| openai_compat | `https://api.openai.com/v1` 或 DeepSeek 兼容地址 | `gpt-4o-mini` / `text-embedding-3-small` |
| ollama | `http://127.0.0.1:11434` | `llama3.2` / `nomic-embed-text` |

API Key 保存在本机 `apps/api/data/config.json`，不会提交到 Git。

切换 Embedding 模型后，如检索异常，请重新上传文档以重建索引。

## API

- `GET /api/health`
- `GET/PUT /api/settings`
- `GET/POST/DELETE /api/documents`
- `POST /api/chat`（SSE：`citations` / `token` / `done`）

## 目录

```
apps/
  api/   FastAPI + Chroma + Providers
  web/   React 工作台
```

## License

MIT

---

## English

Self-hosted RAG desk with pluggable providers (`mock`, OpenAI-compatible, Ollama), document ingest, and citation-aware chat streaming.
