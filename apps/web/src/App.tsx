import { useEffect, useMemo, useRef, useState } from 'react'
import {
  createKnowledgeBase,
  deleteDocument,
  fetchProviderStatus,
  fetchSettings,
  getActiveKbId,
  importSampleDocument,
  listDocuments,
  listKnowledgeBases,
  reindexDocuments,
  saveSettings,
  setActiveKbId,
  streamChat,
  uploadDocumentStream,
  type ChatMessage,
  type Citation,
  type DocumentInfo,
  type KnowledgeBase,
  type ProviderName,
  type ProviderStatus,
  type Settings,
} from './api'
import { DeskSelect } from './DeskSelect'

type Tab = 'library' | 'chat' | 'eval' | 'settings'

function chatHistoryKey() {
  return `ragdesk:chat:v1:${getActiveKbId()}`
}
const EVAL_QUESTIONS = [
  '这个项目是做什么的？',
  '如何本地启动？',
  '支持哪些模型 Provider？',
]

export default function App() {
  const [tab, setTab] = useState<Tab>('library')
  const [settings, setSettings] = useState<Settings | null>(null)
  const [docs, setDocs] = useState<DocumentInfo[]>([])
  const [kbs, setKbs] = useState<KnowledgeBase[]>([])
  const [kbId, setKbId] = useState(getActiveKbId())
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  async function refresh() {
    const [s, d, kbList] = await Promise.all([
      fetchSettings(),
      listDocuments(),
      listKnowledgeBases(),
    ])
    setSettings(s)
    setDocs(d)
    setKbs(kbList)
    if (!kbList.some((k) => k.id === kbId) && kbList[0]) {
      setActiveKbId(kbList[0].id)
      setKbId(kbList[0].id)
    }
  }

  useEffect(() => {
    void refresh().catch((err: Error) =>
      setStatus(err.message || 'Failed to load API'),
    )
  }, [kbId])

  // Read-only shared conversation snapshot from URL hash.
  const shareMessages = useMemo(() => {
    const hash = window.location.hash
    if (!hash.startsWith('#share=')) return null
    try {
      const raw = decodeURIComponent(escape(atob(hash.slice(7))))
      return JSON.parse(raw) as ChatMessage[]
    } catch {
      return []
    }
  }, [])

  if (shareMessages) {
    return (
      <div className="shell share-shell">
        <main className="stage share-stage">
          <section className="panel">
            <div className="panel__head">
              <div>
                <h2>分享的对话（只读）</h2>
                <p>这是一个本地快照链接，不包含你的密钥与资料库。</p>
              </div>
            </div>
            <div className="chat__thread">
              {shareMessages.length === 0 ? (
                <div className="empty">分享内容为空或已损坏。</div>
              ) : (
                shareMessages.map((m, idx) => (
                  <article
                    key={`${m.role}-${idx}`}
                    className={m.role === 'user' ? 'bubble bubble--user' : 'bubble'}
                  >
                    <p>{m.content}</p>
                  </article>
                ))
              )}
            </div>
          </section>
        </main>
      </div>
    )
  }

  return (
    <div className="shell">
      <aside className="rail">
        <div className="rail__brand">
          <div className="rail__mark" aria-hidden="true" />
          <h1>
            rag<span>desk</span>
          </h1>
          <p>把文档放进抽屉，再当面问它。</p>
        </div>
        <div className="rail__kb">
          <DeskSelect
            tone="dark"
            label="知识库"
            aria-label="选择知识库"
            value={kbId}
            data={kbs.map((kb) => ({ value: kb.id, label: kb.name }))}
            onChange={(id) => {
              setActiveKbId(id)
              setKbId(id)
            }}
          />
          <button
            type="button"
            className="btn btn--ghost rail__kb-add"
            onClick={() => {
              const name = window.prompt('新知识库名称')
              if (!name) return
              void createKnowledgeBase(name)
                .then((kb) => {
                  setActiveKbId(kb.id)
                  setKbId(kb.id)
                  setStatus(`已创建知识库：${kb.name}`)
                })
                .catch((err: Error) => setStatus(err.message))
            }}
          >
            新建
          </button>
        </div>
        <nav className="rail__nav" aria-label="主导航">
          {(
            [
              ['library', '资料库'],
              ['chat', '对话'],
              ['eval', '评测'],
              ['settings', '设置'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={tab === id ? 'rail__link is-active' : 'rail__link'}
              onClick={() => setTab(id)}
            >
              <span className="rail__dot" aria-hidden="true" />
              {label}
            </button>
          ))}
        </nav>
        <div className="rail__meta">
          <div>
            <small>已入库</small>
            <strong>{docs.length}</strong>
          </div>
          <div>
            <small>模型接口</small>
            <strong>{settings?.provider ?? '…'}</strong>
          </div>
        </div>
      </aside>

      <div className="stage">
        {status ? (
          <p className="banner" role="status">
            {status}
          </p>
        ) : null}

        <main className="stage__main" key={tab}>
          {tab === 'library' ? (
            <LibraryPanel
              docs={docs}
              busy={busy}
              setBusy={setBusy}
              setStatus={setStatus}
              onChange={() => void refresh()}
            />
          ) : null}
          {tab === 'chat' ? (
            <ChatPanel
              kbId={kbId}
              setStatus={setStatus}
              provider={settings?.provider}
            />
          ) : null}
          {tab === 'eval' ? <EvalPanel setStatus={setStatus} /> : null}
          {tab === 'settings' ? (
            <SettingsPanel
              settings={settings}
              setSettings={setSettings}
              setStatus={setStatus}
            />
          ) : null}
        </main>
      </div>
    </div>
  )
}

function LibraryPanel({
  docs,
  busy,
  setBusy,
  setStatus,
  onChange,
}: {
  docs: DocumentInfo[]
  busy: boolean
  setBusy: (v: boolean) => void
  setStatus: (v: string) => void
  onChange: () => void
}) {
  const [dragOver, setDragOver] = useState(false)
  const [stageText, setStageText] = useState('')

  async function ingestFiles(fileList: FileList | File[] | null) {
    if (!fileList) return
    const files = Array.from(fileList).filter((f) =>
      /\.(md|markdown|txt|pdf)$/i.test(f.name),
    )
    if (!files.length) {
      setStatus('仅支持 .md / .txt / .pdf')
      return
    }
    setBusy(true)
    try {
      for (const file of files) {
        setStageText(`${file.name}：准备上传`)
        await uploadDocumentStream(file, (event) => {
          if (event.type === 'stage') {
            setStageText(`${file.name}：${event.detail || event.stage}`)
          }
        })
      }
      setStatus(`已处理 ${files.length} 个文件`)
      onChange()
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setBusy(false)
      setStageText('')
    }
  }

  async function onDelete(id: string, name: string) {
    if (!window.confirm(`删除 ${name}？`)) return
    setBusy(true)
    try {
      await deleteDocument(id)
      setStatus(`已删除 ${name}`)
      onChange()
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  async function onReindex() {
    if (docs.length === 0) {
      setStatus('没有可重建的文档')
      return
    }
    if (!window.confirm('按当前 Provider / Embedding 重建全部索引？')) return
    setBusy(true)
    try {
      const result = await reindexDocuments()
      setStatus(
        `索引重建完成：成功 ${result.rebuilt}，失败 ${result.failed}，共 ${result.total} 份`,
      )
      onChange()
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Reindex failed')
    } finally {
      setBusy(false)
    }
  }

  async function onSample() {
    setBusy(true)
    try {
      const doc = await importSampleDocument()
      setStatus(`已导入示例：${doc.filename}`)
      onChange()
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Sample import failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel">
      <div className="panel__head">
        <div>
          <h2>资料库</h2>
          <p>放入 Markdown、TXT 或 PDF，系统会切段并建立检索索引。</p>
        </div>
        <div className="panel__actions">
          <button
            type="button"
            className="btn btn--ghost"
            disabled={busy}
            onClick={() => void onSample()}
          >
            导入示例
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            disabled={busy || docs.length === 0}
            onClick={() => void onReindex()}
          >
            重建索引
          </button>
          <label className={`btn btn--primary ${busy ? 'is-disabled' : ''}`}>
            {busy ? '处理中…' : '上传文档'}
            <input
              type="file"
              accept=".md,.markdown,.txt,.pdf"
              multiple
              hidden
              disabled={busy}
              onChange={(e) => {
                void ingestFiles(e.target.files)
                e.target.value = ''
              }}
            />
          </label>
        </div>
      </div>

      <div
        className={dragOver ? 'dropzone is-active' : 'dropzone'}
        onDragEnter={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          void ingestFiles(e.dataTransfer.files)
        }}
      >
        {stageText || '把文件拖到这里，或点右上角上传'}
      </div>

      {docs.length === 0 ? (
        <div className="empty">
          <strong>抽屉还是空的</strong>
          <p>先导入示例，或上传一份说明文档。</p>
        </div>
      ) : (
        <ul className="doc-list">
          {docs.map((d) => (
            <li key={d.id} className="doc-item">
              <div className="doc-item__tab" aria-hidden="true" />
              <div className="doc-item__body">
                <strong>{d.filename}</strong>
                <span>
                  {d.status === 'ready'
                    ? `${d.chunk_count} 段 / ${(d.size / 1024).toFixed(1)} KB`
                    : d.status === 'processing'
                      ? '处理中…'
                      : d.error || '入库失败'}
                </span>
              </div>
              <button
                type="button"
                className="btn btn--ghost"
                disabled={busy}
                onClick={() => void onDelete(d.id, d.filename)}
              >
                删除
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function ChatPanel({
  kbId,
  setStatus,
  provider,
}: {
  kbId: string
  setStatus: (v: string) => void
  provider?: ProviderName
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const raw = localStorage.getItem(chatHistoryKey())
      return raw ? (JSON.parse(raw) as ChatMessage[]) : []
    } catch {
      return []
    }
  })
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [mode, setMode] = useState<'rag' | 'agent'>('rag')
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null)
  const [stage, setStage] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const lastUserRef = useRef('')

  useEffect(() => {
    try {
      const raw = localStorage.getItem(chatHistoryKey())
      setMessages(raw ? (JSON.parse(raw) as ChatMessage[]) : [])
    } catch {
      setMessages([])
    }
    setActiveCitation(null)
    lastUserRef.current = ''
  }, [kbId])

  useEffect(() => {
    localStorage.setItem(chatHistoryKey(), JSON.stringify(messages))
  }, [messages, kbId])

  const canSend = useMemo(
    () => input.trim().length > 0 && !streaming,
    [input, streaming],
  )

  async function runChat(history: ChatMessage[]) {
    setStreaming(true)
    setStatus('')
    setStage('')
    const controller = new AbortController()
    abortRef.current = controller
    try {
      await streamChat(
        history.map((m) => ({ role: m.role, content: m.content })),
        4,
        (event) => {
          if (event.type === 'stage') {
            setStage(
              (event as { detail?: string }).detail ||
                (event as { stage?: string }).stage ||
                '',
            )
          }
          if (event.type === 'citations' && event.citations) {
            const citations = event.citations
            setMessages((prev) => {
              const copy = [...prev]
              const last = copy[copy.length - 1]
              if (last?.role === 'assistant') {
                copy[copy.length - 1] = { ...last, citations }
              }
              return copy
            })
          }
          if (event.type === 'token' && event.content) {
            setMessages((prev) => {
              const copy = [...prev]
              const last = copy[copy.length - 1]
              if (last?.role === 'assistant') {
                copy[copy.length - 1] = {
                  ...last,
                  content: last.content + event.content,
                }
              }
              return copy
            })
          }
        },
        controller.signal,
        mode,
      )
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setStatus('已停止生成')
      } else {
        setStatus(err instanceof Error ? err.message : 'Chat failed')
      }
    } finally {
      setStreaming(false)
      abortRef.current = null
      setStage('')
    }
  }

  async function send() {
    const text = input.trim()
    if (!text || streaming) return
    lastUserRef.current = text
    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: 'user', content: text },
    ]
    setMessages([...nextMessages, { role: 'assistant', content: '', citations: [] }])
    setInput('')
    await runChat(nextMessages)
  }

  async function retryLast() {
    const text = lastUserRef.current
    if (!text || streaming) return
    const withoutTail = [...messages]
    while (withoutTail.length && withoutTail[withoutTail.length - 1].role === 'assistant') {
      withoutTail.pop()
    }
    if (withoutTail[withoutTail.length - 1]?.role === 'user') {
      withoutTail.pop()
    }
    const nextMessages: ChatMessage[] = [
      ...withoutTail,
      { role: 'user', content: text },
    ]
    setMessages([...nextMessages, { role: 'assistant', content: '', citations: [] }])
    await runChat(nextMessages)
  }

  return (
    <section className="panel chat">
      <div className="panel__head">
        <div>
          <h2>对话</h2>
          <p>
            正在使用 <strong>{provider ?? '…'}</strong>
            {stage ? ` · ${stage}` : ''}
          </p>
        </div>
        <div className="panel__actions">
          <DeskSelect
            tone="light"
            aria-label="检索模式"
            className="desk-select--inline"
            value={mode}
            disabled={streaming}
            data={[
              { value: 'rag', label: '直接检索' },
              { value: 'agent', label: 'Agent（先改写再检索）' },
            ]}
            onChange={(v) => setMode(v as 'rag' | 'agent')}
          />
          {streaming ? (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => abortRef.current?.abort()}
            >
              停止
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn--ghost"
            disabled={streaming || !lastUserRef.current}
            onClick={() => void retryLast()}
          >
            重试
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--danger"
            onClick={() => {
              setMessages([])
              setActiveCitation(null)
              localStorage.removeItem(chatHistoryKey())
            }}
          >
            清空对话
          </button>
        </div>
      </div>

      <div className="chat__thread">
        {messages.length === 0 ? (
          <div className="empty">
            <strong>从资料里找答案</strong>
            <p>例如：这份文档里怎么启动服务？</p>
          </div>
        ) : (
          messages.map((m, idx) => (
            <article
              key={`${m.role}-${idx}`}
              className={m.role === 'user' ? 'bubble bubble--user' : 'bubble'}
            >
              <p>
                {m.content ||
                  (streaming && idx === messages.length - 1 ? '正在生成…' : '')}
              </p>
              {m.citations && m.citations.length > 0 ? (
                <div className="cites">
                  {m.citations.map((c, i) => (
                    <button
                      key={`${c.document_id}-${i}`}
                      type="button"
                      className="cite"
                      onClick={() => setActiveCitation(c)}
                    >
                      {c.filename}
                      {c.chunk_index != null ? ` #${c.chunk_index}` : ''}
                    </button>
                  ))}
                </div>
              ) : null}
            </article>
          ))
        )}
      </div>

      {activeCitation ? (
        <aside className="cite-panel">
          <div className="cite-panel__head">
            <strong>
              {activeCitation.filename}
              {activeCitation.chunk_index != null
                ? ` · 片段 ${activeCitation.chunk_index}`
                : ''}
            </strong>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setActiveCitation(null)}
            >
              关闭
            </button>
          </div>
          <pre>{activeCitation.excerpt}</pre>
        </aside>
      ) : null}

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault()
          void send()
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="针对已入库文档提问"
          disabled={streaming}
        />
        <button type="submit" className="btn btn--primary" disabled={!canSend}>
          {streaming ? '生成中' : '发送'}
        </button>
      </form>
    </section>
  )
}

function EvalPanel({ setStatus }: { setStatus: (v: string) => void }) {
  const [running, setRunning] = useState(false)
  const [rows, setRows] = useState<
    { question: string; answer: string; citations: Citation[] }[]
  >([])

  async function runEval() {
    setRunning(true)
    setRows([])
    setStatus('评测开始…')
    try {
      const next: { question: string; answer: string; citations: Citation[] }[] =
        []
      for (const question of EVAL_QUESTIONS) {
        let answer = ''
        let citations: Citation[] = []
        await streamChat(
          [{ role: 'user', content: question }],
          4,
          (event) => {
            if (event.type === 'citations' && event.citations) {
              citations = event.citations
            }
            if (event.type === 'token' && event.content) {
              answer += event.content
            }
          },
          undefined,
          'rag',
        )
        next.push({ question, answer, citations })
        setRows([...next])
      }
      setStatus(`评测完成：${next.length} 题`)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Eval failed')
    } finally {
      setRunning(false)
    }
  }

  return (
    <section className="panel">
      <div className="panel__head">
        <div>
          <h2>评测</h2>
          <p>用固定问题集快速对比当前知识库与模型效果。</p>
        </div>
        <button
          type="button"
          className="btn btn--primary"
          disabled={running}
          onClick={() => void runEval()}
        >
          {running ? '评测中…' : '跑一遍评测'}
        </button>
      </div>
      {rows.length === 0 ? (
        <div className="empty">
          <strong>还没有评测结果</strong>
          <p>先确保资料库有文档，再点右上角开始。</p>
        </div>
      ) : (
        <div className="eval-list">
          {rows.map((row) => (
            <article key={row.question} className="eval-card">
              <h3>{row.question}</h3>
              <p>{row.answer || '（无回答）'}</p>
              <small>{row.citations.length} 条引用</small>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function SettingsPanel({
  settings,
  setSettings,
  setStatus,
}: {
  settings: Settings | null
  setSettings: (s: Settings) => void
  setStatus: (v: string) => void
}) {
  const [provider, setProvider] = useState<ProviderName>('mock')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [chatModel, setChatModel] = useState('')
  const [embeddingModel, setEmbeddingModel] = useState('')
  const [saving, setSaving] = useState(false)
  const [probing, setProbing] = useState(false)
  const [probe, setProbe] = useState<ProviderStatus | null>(null)
  const [shareUrl, setShareUrl] = useState('')

  useEffect(() => {
    if (!settings) return
    setProvider(settings.provider)
    setBaseUrl(settings.base_url)
    setChatModel(settings.chat_model)
    setEmbeddingModel(settings.embedding_model)
    setApiKey('')
  }, [settings])

  async function onSave() {
    setSaving(true)
    try {
      const next = await saveSettings({
        provider,
        base_url: baseUrl,
        chat_model: chatModel,
        embedding_model: embeddingModel,
        ...(apiKey ? { api_key: apiKey } : {}),
      })
      setSettings(next)
      setApiKey('')
      setStatus(
        next.has_documents
          ? '设置已保存。若更换了 Embedding，请到资料库点「重建索引」。'
          : '设置已保存。',
      )
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function onProbe() {
    setProbing(true)
    try {
      await saveSettings({
        provider,
        base_url: baseUrl,
        chat_model: chatModel,
        embedding_model: embeddingModel,
        ...(apiKey ? { api_key: apiKey } : {}),
      })
      const status = await fetchProviderStatus()
      setProbe(status)
      setStatus(status.ok ? status.message : `连通失败：${status.message}`)
    } catch (err) {
      setProbe(null)
      setStatus(err instanceof Error ? err.message : 'Probe failed')
    } finally {
      setProbing(false)
    }
  }

  function makeShareLink() {
    const raw = localStorage.getItem(chatHistoryKey()) || '[]'
    const encoded = btoa(unescape(encodeURIComponent(raw)))
    const url = `${window.location.origin}${window.location.pathname}#share=${encoded}`
    setShareUrl(url)
    void navigator.clipboard.writeText(url).then(
      () => setStatus('只读分享链接已复制（含当前对话快照）'),
      () => setStatus('已生成分享链接，可手动复制'),
    )
  }

  return (
    <section className="panel">
      <div className="panel__head">
        <div>
          <h2>设置</h2>
          <p>
            切换 Mock、OpenAI 兼容接口或 Ollama。密钥只保存在本机，不会上传。
          </p>
        </div>
        <div className="panel__actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={makeShareLink}
          >
            复制对话分享链接
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            disabled={probing || !settings}
            onClick={() => void onProbe()}
          >
            {probing ? '检测中…' : '检测连通'}
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={saving || !settings}
            onClick={() => void onSave()}
          >
            {saving ? '保存中…' : '保存设置'}
          </button>
        </div>
      </div>

      {probe ? (
        <div className={probe.ok ? 'probe probe--ok' : 'probe probe--bad'}>
          <strong>{probe.ok ? '已连通' : '未连通'}</strong>
          <span>{probe.message}</span>
        </div>
      ) : null}

      {shareUrl ? (
        <div className="probe">
          <strong>分享链接</strong>
          <span className="share-url">{shareUrl}</span>
        </div>
      ) : null}

      <div className="form-grid">
        <label className="desk-select-field">
          <DeskSelect
            tone="light"
            label="Provider"
            aria-label="Provider"
            value={provider}
            data={[
              { value: 'mock', label: 'mock（本地演示）' },
              {
                value: 'openai_compat',
                label: 'openai_compat（OpenAI / DeepSeek 等）',
              },
              { value: 'ollama', label: 'ollama' },
            ]}
            onChange={(v) => setProvider(v as ProviderName)}
          />
        </label>
        <label>
          <span>Base URL</span>
          <input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={
              provider === 'ollama'
                ? 'http://127.0.0.1:11434'
                : 'https://api.openai.com/v1'
            }
          />
        </label>
        <label>
          <span>Chat Model</span>
          <input
            list="chat-model-options"
            value={chatModel}
            onChange={(e) => setChatModel(e.target.value)}
            placeholder="gpt-4o-mini / llama3.2"
          />
          <datalist id="chat-model-options">
            {(probe?.chat_models ?? []).map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </label>
        <label>
          <span>Embedding Model</span>
          <input
            list="embed-model-options"
            value={embeddingModel}
            onChange={(e) => setEmbeddingModel(e.target.value)}
            placeholder="text-embedding-3-small / nomic-embed-text"
          />
          <datalist id="embed-model-options">
            {(probe?.embedding_models ?? []).map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </label>
        <label className="span-2">
          <span>
            API Key {settings?.api_key_set ? '（已设置，留空则保持不变）' : ''}
          </span>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            autoComplete="off"
          />
        </label>
      </div>
    </section>
  )
}
