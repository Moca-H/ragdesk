import { useEffect, useMemo, useState } from 'react'
import {
  deleteDocument,
  fetchProviderStatus,
  fetchSettings,
  listDocuments,
  reindexDocuments,
  saveSettings,
  streamChat,
  uploadDocument,
  type ChatMessage,
  type Citation,
  type DocumentInfo,
  type ProviderName,
  type ProviderStatus,
  type Settings,
} from './api'

type Tab = 'library' | 'chat' | 'settings'

export default function App() {
  const [tab, setTab] = useState<Tab>('library')
  const [settings, setSettings] = useState<Settings | null>(null)
  const [docs, setDocs] = useState<DocumentInfo[]>([])
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  async function refresh() {
    const [s, d] = await Promise.all([fetchSettings(), listDocuments()])
    setSettings(s)
    setDocs(d)
  }

  useEffect(() => {
    void refresh().catch((err: Error) =>
      setStatus(err.message || 'Failed to load API'),
    )
  }, [])

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
        <nav className="rail__nav" aria-label="主导航">
          {(
            [
              ['library', '资料库'],
              ['chat', '对话'],
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
            <ChatPanel setStatus={setStatus} provider={settings?.provider} />
          ) : null}
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
  async function onUpload(fileList: FileList | null) {
    if (!fileList?.length) return
    setBusy(true)
    try {
      for (const file of Array.from(fileList)) {
        const doc = await uploadDocument(file)
        if (doc.status === 'error') {
          setStatus(`${doc.filename}: ${doc.error || 'ingest failed'}`)
        } else {
          setStatus(`已入库：${doc.filename}（${doc.chunk_count} chunks）`)
        }
      }
      onChange()
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setBusy(false)
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
                void onUpload(e.target.files)
                e.target.value = ''
              }}
            />
          </label>
        </div>
      </div>

      {docs.length === 0 ? (
        <div className="empty">
          <strong>抽屉还是空的</strong>
          <p>上传一份说明文档，再去对话页提问。</p>
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
  setStatus,
  provider,
}: {
  setStatus: (v: string) => void
  provider?: ProviderName
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null)

  const canSend = useMemo(
    () => input.trim().length > 0 && !streaming,
    [input, streaming],
  )

  async function send() {
    const text = input.trim()
    if (!text || streaming) return
    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: 'user', content: text },
    ]
    setMessages([...nextMessages, { role: 'assistant', content: '', citations: [] }])
    setInput('')
    setStreaming(true)
    setStatus('')

    try {
      let citations: Citation[] = []
      await streamChat(
        nextMessages.map((m) => ({ role: m.role, content: m.content })),
        4,
        (event) => {
          if (event.type === 'citations' && event.citations) {
            citations = event.citations
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
      )
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Chat failed')
    } finally {
      setStreaming(false)
    }
  }

  return (
    <section className="panel chat">
      <div className="panel__head">
        <div>
          <h2>对话</h2>
          <p>
            正在使用 <strong>{provider ?? '…'}</strong>
            ，回答会标出引用片段。
          </p>
        </div>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => {
            setMessages([])
            setActiveCitation(null)
          }}
        >
          清空对话
        </button>
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
            <strong>{activeCitation.filename}</strong>
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
      // Persist draft settings first so probe uses the values on screen.
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

      <div className="form-grid">
        <label>
          <span>Provider</span>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as ProviderName)}
          >
            <option value="mock">mock（本地演示）</option>
            <option value="openai_compat">openai_compat（OpenAI / DeepSeek 等）</option>
            <option value="ollama">ollama</option>
          </select>
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
