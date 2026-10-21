# ragdesk

可切换 Provider 的**本地知识库问答**（RAG）。

上传 Markdown / TXT / PDF → 切分向量化 → 对话，并展示检索引用。

- **前端**：Vite + React + TypeScript  
- **后端**：FastAPI + Chroma  
- **Provider**：`mock`（开箱演示） / `openai_compat`（OpenAI、DeepSeek 等） / `ollama`

## 快速开始

### 1. 后端

```bash
cd apps/api
python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS / Linux
# source .venv/bin/activate

pip install -r requirements.txt
copy .env.example .env   # Windows；Unix 用 cp
uvicorn app.main:app --reload --port 8000
```

### 2. 前端

```bash
cd apps/web
npm install
npm run dev
```

打开 http://127.0.0.1:5173  

默认 Provider 为 **mock**，无需 Key 即可体验上传与问答流程。

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
