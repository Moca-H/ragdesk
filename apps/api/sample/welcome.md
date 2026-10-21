# ragdesk 欢迎文档

这是一份用于本地演示的示例知识库文档。导入后即可在「对话」里提问。

## 这个项目是做什么的？

ragdesk 是一个可切换 Provider 的本地知识库问答（RAG）工作台：

1. 上传 Markdown / TXT / PDF / Word（.docx）/ Excel（.xlsx）
2. 自动切分并向量化
3. 基于检索片段回答问题，并展示引用来源

支持多知识库隔离、混合检索（向量 + BM25）、Agent 改写检索，以及评测面板。

## 如何本地启动？

Windows 一键启动：

```powershell
.\dev.cmd
```

或：

```powershell
npm run dev
```

浏览器打开 http://127.0.0.1:5173 。默认 Provider 为 mock，无需 API Key。

Docker：

```bash
docker compose up --build
```

打开 http://127.0.0.1:8080 。

## 支持哪些模型 Provider？

| Provider | 说明 |
|----------|------|
| mock | 本地演示，无需密钥 |
| openai_compat | OpenAI / DeepSeek 等兼容接口 |
| ollama | 本机 Ollama |

在「设置」页配置 Base URL、Chat Model、Embedding Model，并点「检测连通」。更换 Embedding 后请到资料库点「重建索引」。

## 常用操作

- 资料库：拖拽上传、导入示例、重建索引
- 对话：停止 / 重试、直接检索或 Agent 模式
- 评测：用固定问题集快速看效果
- 设置：复制只读对话分享链接
