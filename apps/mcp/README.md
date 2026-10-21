# ragdesk-mcp

MCP server for [ragdesk](https://github.com/Moca-H/ragdesk). Talk to your local RAG API from Cursor / Claude Desktop via tools.

## Prerequisites

1. A running ragdesk API (e.g. `npm run dev` or Docker) at `http://127.0.0.1:8000`
2. Python 3.11+ (for local install) or [`uv`](https://github.com/astral-sh/uv) for `uvx`

## Install from PyPI

```bash
uvx ragdesk-mcp
```

Or:

```bash
pip install ragdesk-mcp
ragdesk-mcp
```

## Cursor `mcp.json` example

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

Local checkout (dev):

```json
{
  "mcpServers": {
    "ragdesk": {
      "command": "python",
      "args": ["-m", "ragdesk_mcp.server"],
      "cwd": "D:/Moca/ragdesk/apps/mcp",
      "env": {
        "PYTHONPATH": "D:/Moca/ragdesk/apps/mcp/src",
        "RAGDESK_API_BASE": "http://127.0.0.1:8000"
      }
    }
  }
}
```

## Environment

| Variable | Default | Meaning |
|----------|---------|---------|
| `RAGDESK_API_BASE` | `http://127.0.0.1:8000` | ragdesk API root |
| `RAGDESK_KB` | `default` | Default knowledge base id |
| `RAGDESK_API_TOKEN` | _(empty)_ | Optional `Authorization: Bearer` |

## Tools

- `ragdesk_health` — API reachability
- `list_knowledge_bases` — list KBs
- `list_documents` — list docs in a KB
- `ingest_text` — upload markdown/text into a KB
- `import_sample` — import welcome sample
- `ask` — RAG / agent Q&A with citations

## Develop

```bash
cd apps/mcp
pip install -e .
ragdesk-mcp
```

## Publish

GitHub Actions publishes to PyPI when you push a tag:

```bash
git tag ragdesk-mcp-v0.1.0
git push origin ragdesk-mcp-v0.1.0
```

Requires repository secret `PYPI_API_TOKEN` (PyPI API token, username `__token__`).
