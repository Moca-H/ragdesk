import { useEffect, useMemo, useState } from 'react'
import {
  deleteDocument,
  fetchSettings,
  listDocuments,
  saveSettings,
  streamChat,
  uploadDocument,
  type ChatMessage,
  type Citation,
  type DocumentInfo,
  type ProviderName,
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
    <div className="app">
      <header className="top">
        <div>
          <p className="eyebrow">self-hosted · RAG</p>
          <h1>ragdesk</h1>
        </div>
        <nav className="tabs" aria-label="Primary">
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
              className={tab === id ? 'tab is-active' : 'tab'}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      {status ? <p className="banner">{status}</p> : null}

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

  return (
    <section className="panel">
      <div className="panel__head">
        <div>
          <h2>资料库</h2>
          <p>支持 .md / .txt / .pdf。上传后自动切分并写入向量库。</p>
        </div>
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

      {docs.length === 0 ? (
        <div className="empty">还没有文档。先上传一份 Markdown 试试。</div>
      ) : (
        <ul className="doc-list">
          {docs.map((d) => (
            <li key={d.id} className="doc-item">
              <div>
                <strong>{d.filename}</strong>
                <span>
                  {d.status === 'ready'
                    ? `${d.chunk_count} chunks · ${(d.size / 1024).toFixed(1)} KB`
                    : d.error || 'error'}
                </span>
              </div>
              <button
                type="button"
                className="btn btn--danger"
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
            当前 Provider：<strong>{provider ?? '…'}</strong>
            。回答会附带检索引用。
          </p>
        </div>
        <button
          type="button"
          className="btn"
          onClick={() => {
            setMessages([])
            setActiveCitation(null)
          }}
        >
          清空
        </button>
      </div>

      <div className="chat__thread">
        {messages.length === 0 ? (
          <div className="empty">问一个关于已上传文档的问题。</div>
        ) : (
          messages.map((m, idx) => (
            <article
              key={`${m.role}-${idx}`}
              className={m.role === 'user' ? 'bubble bubble--user' : 'bubble'}
            >
              <p>{m.content || (streaming && idx === messages.length - 1 ? '…' : '')}</p>
              {m.citations && m.citations.length > 0 ? (
                <div className="cites">
                  {m.citations.map((c, i) => (
                    <button
                      key={`${c.document_id}-${i}`}
                      type="button"
                      className="cite"
                      onClick={() => setActiveCitation(c)}
                    >
                      来源 {i + 1}: {c.filename}
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
            <button type="button" className="btn" onClick={() => setActiveCitation(null)}>
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
          placeholder="基于资料库提问…"
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
          ? '设置已保存。切换 Provider/Embedding 后如检索异常，请重新上传文档重建索引。'
          : '设置已保存。',
      )
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="panel">
      <div className="panel__head">
        <div>
          <h2>设置</h2>
          <p>可切换 Mock / OpenAI 兼容 API / Ollama。API Key 只保存在本机 data/config.json。</p>
        </div>
        <button
          type="button"
          className="btn btn--primary"
          disabled={saving || !settings}
          onClick={() => void onSave()}
        >
          {saving ? '保存中…' : '保存'}
        </button>
      </div>

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
            value={chatModel}
            onChange={(e) => setChatModel(e.target.value)}
            placeholder="gpt-4o-mini / llama3.2"
          />
        </label>
        <label>
          <span>Embedding Model</span>
          <input
            value={embeddingModel}
            onChange={(e) => setEmbeddingModel(e.target.value)}
            placeholder="text-embedding-3-small / nomic-embed-text"
          />
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
