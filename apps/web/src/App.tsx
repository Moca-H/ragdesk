import { Modal, Text, TextInput as MantineTextInput } from '@mantine/core'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  createKnowledgeBase,
  deleteDocument,
  deleteDocumentsBatch,
  exportKnowledgeBase,
  fetchHealthDetail,
  fetchProviderStatus,
  fetchSettings,
  fetchWatchConfig,
  getActiveKbId,
  getApiToken,
  importKnowledgeBase,
  importSampleDocument,
  ingestTextDocument,
  ingestUrlDocument,
  listDocuments,
  listKnowledgeBases,
  reindexDocuments,
  saveSettings,
  saveWatchConfig,
  setActiveKbId,
  setApiToken,
  setKnowledgeBaseReadonly,
  streamChat,
  uploadDocumentStream,
  type ChatMessage,
  type Citation,
  type DocumentInfo,
  type HealthDetail,
  type KnowledgeBase,
  type ProviderName,
  type ProviderStatus,
  type Settings,
  type WatchConfig,
} from './api'
import { DeskConfirm } from './DeskConfirm'
import { DeskSelect } from './DeskSelect'
import './DeskModal.css'

type Tab = 'library' | 'chat' | 'eval' | 'health' | 'settings'

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
  const [kbModalOpen, setKbModalOpen] = useState(false)
  const [newKbName, setNewKbName] = useState('')
  const [creatingKb, setCreatingKb] = useState(false)

  function openKbModal() {
    setNewKbName('')
    setKbModalOpen(true)
  }

  function closeKbModal() {
    if (creatingKb) return
    setKbModalOpen(false)
  }

  async function submitNewKb() {
    const name = newKbName.trim()
    if (!name) {
      setStatus('请填写知识库名称')
      return
    }
    setCreatingKb(true)
    try {
      const kb = await createKnowledgeBase(name)
      setActiveKbId(kb.id)
      setKbId(kb.id)
      setStatus(`已创建知识库：${kb.name}`)
      setKbModalOpen(false)
      setNewKbName('')
    } catch (err) {
      setStatus(err instanceof Error ? err.message : '创建失败')
    } finally {
      setCreatingKb(false)
    }
  }

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
            onClick={openKbModal}
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
              ['health', '健康'],
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
          {tab === 'health' ? <HealthPanel setStatus={setStatus} /> : null}
          {tab === 'settings' ? (
            <SettingsPanel
              settings={settings}
              setSettings={setSettings}
              setStatus={setStatus}
              kbs={kbs}
              kbId={kbId}
              onKbMeta={() => void refresh()}
            />
          ) : null}
        </main>
      </div>

      <Modal
        className="desk-modal"
        opened={kbModalOpen}
        onClose={closeKbModal}
        title="新建知识库"
        centered
        radius="md"
        overlayProps={{ backgroundOpacity: 0.45, blur: 2 }}
        transitionProps={{ transition: 'pop', duration: 160 }}
      >
        <Text size="sm" mb="sm">
          为不同主题或项目单独开一个抽屉，资料互不影响。
        </Text>
        <MantineTextInput
          label="名称"
          placeholder="例如：产品手册 / 论文笔记"
          value={newKbName}
          onChange={(e) => setNewKbName(e.currentTarget.value)}
          maxLength={64}
          data-autofocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void submitNewKb()
            }
          }}
        />
        <div className="desk-modal__actions">
          <button
            type="button"
            className="desk-modal__btn"
            disabled={creatingKb}
            onClick={closeKbModal}
          >
            取消
          </button>
          <button
            type="button"
            className="desk-modal__btn desk-modal__btn--primary"
            disabled={creatingKb || !newKbName.trim()}
            onClick={() => void submitNewKb()}
          >
            {creatingKb ? '创建中…' : '创建'}
          </button>
        </div>
      </Modal>
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
  const [selected, setSelected] = useState<string[]>([])
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [pasteName, setPasteName] = useState('note.md')
  const [urlOpen, setUrlOpen] = useState(false)
  const [urlValue, setUrlValue] = useState('')
  const [confirm, setConfirm] = useState<
    | null
    | { kind: 'delete'; id: string; name: string }
    | { kind: 'reindex' }
    | { kind: 'batch' }
  >(null)

  async function ingestFiles(fileList: FileList | File[] | null) {
    if (!fileList) return
    const files = Array.from(fileList).filter((f) =>
      /\.(md|markdown|txt|pdf|docx|xlsx)$/i.test(f.name),
    )
    if (!files.length) {
      setStatus('仅支持 .md / .txt / .pdf / .docx / .xlsx')
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

  function askDelete(id: string, name: string) {
    setConfirm({ kind: 'delete', id, name })
  }

  function askReindex() {
    if (docs.length === 0) {
      setStatus('没有可重建的文档')
      return
    }
    setConfirm({ kind: 'reindex' })
  }

  async function runConfirmed() {
    if (!confirm) return
    const current = confirm
    setConfirm(null)
    setBusy(true)
    try {
      if (current.kind === 'delete') {
        await deleteDocument(current.id)
        setStatus(`已删除 ${current.name}`)
      } else if (current.kind === 'batch') {
        const n = await deleteDocumentsBatch(selected)
        setSelected([])
        setStatus(`已批量删除 ${n} 份文档`)
      } else {
        const result = await reindexDocuments()
        setStatus(
          `索引重建完成：成功 ${result.rebuilt}，失败 ${result.failed}，共 ${result.total} 份`,
        )
      }
      onChange()
    } catch (err) {
      setStatus(err instanceof Error ? err.message : '操作失败')
    } finally {
      setBusy(false)
    }
  }

  async function submitPaste() {
    if (!pasteText.trim()) return
    setBusy(true)
    try {
      const doc = await ingestTextDocument(pasteText, pasteName || 'note.md')
      setStatus(`已入库文本：${doc.filename}`)
      setPasteOpen(false)
      setPasteText('')
      onChange()
    } catch (err) {
      setStatus(err instanceof Error ? err.message : '粘贴入库失败')
    } finally {
      setBusy(false)
    }
  }

  async function submitUrl() {
    if (!urlValue.trim()) return
    setBusy(true)
    try {
      const doc = await ingestUrlDocument(urlValue.trim())
      setStatus(`已抓取入库：${doc.filename}`)
      setUrlOpen(false)
      setUrlValue('')
      onChange()
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'URL 入库失败')
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
          <p>放入 Markdown、TXT、PDF、Word（.docx）或 Excel（.xlsx），系统会切段并建立检索索引。</p>
        </div>
        <div className="panel__actions">
          <button
            type="button"
            className="btn btn--ghost"
            disabled={busy}
            onClick={() => setPasteOpen(true)}
          >
            粘贴入库
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            disabled={busy}
            onClick={() => setUrlOpen(true)}
          >
            URL 入库
          </button>
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
            onClick={askReindex}
          >
            重建索引
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--danger"
            disabled={busy || selected.length === 0}
            onClick={() => setConfirm({ kind: 'batch' })}
          >
            批量删除 ({selected.length})
          </button>
          <label className={`btn btn--ghost ${busy ? 'is-disabled' : ''}`}>
            选文件夹
            <input
              type="file"
              multiple
              // @ts-expect-error webkitdirectory is non-standard but widely supported
              webkitdirectory=""
              directory=""
              hidden
              disabled={busy}
              onChange={(e) => {
                void ingestFiles(e.target.files)
                e.target.value = ''
              }}
            />
          </label>
          <label className={`btn btn--primary ${busy ? 'is-disabled' : ''}`}>
            {busy ? '处理中…' : '上传文档'}
            <input
              type="file"
              accept=".md,.markdown,.txt,.pdf,.docx,.xlsx"
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
              <label className="doc-item__check">
                <input
                  type="checkbox"
                  checked={selected.includes(d.id)}
                  onChange={(e) => {
                    setSelected((prev) =>
                      e.target.checked
                        ? [...prev, d.id]
                        : prev.filter((id) => id !== d.id),
                    )
                  }}
                />
              </label>
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
                onClick={() => askDelete(d.id, d.filename)}
              >
                删除
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal
        className="desk-modal"
        opened={pasteOpen}
        onClose={() => setPasteOpen(false)}
        title="粘贴入库"
        centered
      >
        <MantineTextInput
          label="文件名"
          value={pasteName}
          onChange={(e) => setPasteName(e.currentTarget.value)}
          mb="sm"
        />
        <textarea
          className="desk-textarea"
          rows={10}
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder="粘贴 Markdown / 纯文本…"
        />
        <div className="desk-modal__actions">
          <button type="button" className="desk-modal__btn" onClick={() => setPasteOpen(false)}>
            取消
          </button>
          <button
            type="button"
            className="desk-modal__btn desk-modal__btn--primary"
            disabled={busy || !pasteText.trim()}
            onClick={() => void submitPaste()}
          >
            入库
          </button>
        </div>
      </Modal>

      <Modal
        className="desk-modal"
        opened={urlOpen}
        onClose={() => setUrlOpen(false)}
        title="URL 入库"
        centered
      >
        <MantineTextInput
          label="网页地址"
          placeholder="https://..."
          value={urlValue}
          onChange={(e) => setUrlValue(e.currentTarget.value)}
        />
        <div className="desk-modal__actions">
          <button type="button" className="desk-modal__btn" onClick={() => setUrlOpen(false)}>
            取消
          </button>
          <button
            type="button"
            className="desk-modal__btn desk-modal__btn--primary"
            disabled={busy || !urlValue.trim()}
            onClick={() => void submitUrl()}
          >
            抓取并入库
          </button>
        </div>
      </Modal>

      <DeskConfirm
        opened={confirm != null}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void runConfirmed()}
        title={
          confirm?.kind === 'delete'
            ? '删除文档'
            : confirm?.kind === 'batch'
              ? '批量删除'
              : '重建索引'
        }
        message={
          confirm?.kind === 'delete'
            ? `确定删除「${confirm.name}」？此操作不可撤销。`
            : confirm?.kind === 'batch'
              ? `确定删除选中的 ${selected.length} 份文档？`
              : '按当前 Provider / Embedding 重建全部索引？'
        }
        confirmLabel={
          confirm?.kind === 'reindex' ? '开始重建' : '删除'
        }
        danger={confirm?.kind !== 'reindex'}
      />
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
  const [clearConfirm, setClearConfirm] = useState(false)
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
            const stageName = event.stage || ''
            const detail = event.detail || stageName
            setStage(detail)
            if (stageName === 'rewrite_done' && detail) {
              setMessages((prev) => {
                const copy = [...prev]
                const last = copy[copy.length - 1]
                if (last?.role === 'assistant') {
                  copy[copy.length - 1] = { ...last, rewriteQuery: detail }
                }
                return copy
              })
            }
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
            disabled={streaming || messages.length === 0}
            onClick={() => setClearConfirm(true)}
          >
            清空对话
          </button>
        </div>
      </div>

      <DeskConfirm
        opened={clearConfirm}
        onCancel={() => setClearConfirm(false)}
        onConfirm={() => {
          setMessages([])
          setActiveCitation(null)
          localStorage.removeItem(chatHistoryKey())
          setClearConfirm(false)
          setStatus('已清空当前对话')
        }}
        title="清空对话"
        message="清空后将删除本知识库下的本地对话记录，无法撤销。"
        confirmLabel="清空"
        danger
      />

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
              {m.rewriteQuery ? (
                <small className="rewrite-hint">检索改写：{m.rewriteQuery}</small>
              ) : null}
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
          <p className="cite-panel__meta">
            文档 ID：{activeCitation.document_id}
            {activeCitation.chunk_index != null
              ? ` · 片段 #${activeCitation.chunk_index}`
              : ''}
            {activeCitation.score != null
              ? ` · 相关度 ${activeCitation.score}`
              : ''}
          </p>
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

function scoreEval(question: string, answer: string, citations: Citation[]) {
  let score = 0
  if (citations.length > 0) score += 40
  if (answer.trim().length > 20) score += 30
  const keys = question.replace(/[？?]/g, '').split(/\s+/).filter(Boolean)
  const hit = keys.some((k) => answer.includes(k) || citations.some((c) => c.excerpt.includes(k)))
  if (hit) score += 30
  return score
}

function EvalPanel({ setStatus }: { setStatus: (v: string) => void }) {
  const [running, setRunning] = useState(false)
  const [rows, setRows] = useState<
    { question: string; answer: string; citations: Citation[]; score: number }[]
  >([])

  async function runEval() {
    setRunning(true)
    setRows([])
    setStatus('评测开始…')
    try {
      const next: {
        question: string
        answer: string
        citations: Citation[]
        score: number
      }[] = []
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
        const score = scoreEval(question, answer, citations)
        next.push({ question, answer, citations, score })
        setRows([...next])
      }
      const avg = Math.round(
        next.reduce((s, r) => s + r.score, 0) / Math.max(next.length, 1),
      )
      setStatus(`评测完成：${next.length} 题，平均分 ${avg}`)
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
              <small>
                {row.citations.length} 条引用 · 得分 {row.score}/100
              </small>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function HealthPanel({ setStatus }: { setStatus: (v: string) => void }) {
  const [detail, setDetail] = useState<HealthDetail | null>(null)
  const [loading, setLoading] = useState(false)

  async function refresh() {
    setLoading(true)
    try {
      const next = await fetchHealthDetail()
      setDetail(next)
      setStatus(
        next.status === 'ok' ? '健康检查通过' : `健康状态：${next.status}`,
      )
    } catch (err) {
      setDetail(null)
      setStatus(err instanceof Error ? err.message : '健康检查失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  return (
    <section className="panel">
      <div className="panel__head">
        <div>
          <h2>健康</h2>
          <p>查看 Provider、向量库、文档与监视文件夹状态。</p>
        </div>
        <button
          type="button"
          className="btn btn--primary"
          disabled={loading}
          onClick={() => void refresh()}
        >
          {loading ? '刷新中…' : '刷新'}
        </button>
      </div>
      {!detail ? (
        <div className="empty">
          <strong>暂无数据</strong>
          <p>点击右上角刷新拉取状态。</p>
        </div>
      ) : (
        <div className="health-grid">
          <article className="health-card">
            <h3>总体</h3>
            <p className={detail.status === 'ok' ? 'ok' : 'bad'}>
              {detail.status}
            </p>
          </article>
          <article className="health-card">
            <h3>Provider · {detail.provider.name}</h3>
            <p className={detail.provider.ok ? 'ok' : 'bad'}>
              {detail.provider.ok
                ? '正常'
                : detail.provider.error || '异常'}
            </p>
            <small>
              chat {detail.provider.chat_model || '—'} · embed{' '}
              {detail.provider.embedding_model || '—'}
            </small>
          </article>
          <article className="health-card">
            <h3>向量库</h3>
            <p className={detail.vector_store.ok ? 'ok' : 'bad'}>
              {detail.vector_store.ok
                ? `${detail.vector_store.chunk_count} chunks`
                : detail.vector_store.error || '异常'}
            </p>
          </article>
          <article className="health-card">
            <h3>文档</h3>
            <p>
              共 {detail.documents.total} · 就绪 {detail.documents.ready} ·
              失败 {detail.documents.error}
            </p>
          </article>
          <article className="health-card">
            <h3>监视文件夹</h3>
            <p>
              {detail.watch.enabled
                ? `开启 · ${detail.watch.path || '（未设路径）'}`
                : '关闭'}
            </p>
            <small>
              KB {detail.watch.kb_id || 'default'} · 每{' '}
              {detail.watch.poll_seconds}s
            </small>
          </article>
          <article className="health-card">
            <h3>安全</h3>
            <p>
              Token {detail.security.api_token_required ? '已启用' : '未启用'}
              {' · '}
              设置锁定{' '}
              {detail.security.settings_locked ? '是' : '否'}
            </p>
          </article>
        </div>
      )}
    </section>
  )
}

function SettingsPanel({
  settings,
  setSettings,
  setStatus,
  kbs,
  kbId,
  onKbMeta,
}: {
  settings: Settings | null
  setSettings: (s: Settings) => void
  setStatus: (v: string) => void
  kbs: KnowledgeBase[]
  kbId: string
  onKbMeta: () => void
}) {
  const locked = Boolean(settings?.settings_locked)
  const [provider, setProvider] = useState<ProviderName>('mock')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [chatModel, setChatModel] = useState('')
  const [embeddingModel, setEmbeddingModel] = useState('')
  const [clientToken, setClientToken] = useState(getApiToken())
  const [saving, setSaving] = useState(false)
  const [probing, setProbing] = useState(false)
  const [probe, setProbe] = useState<ProviderStatus | null>(null)
  const [shareUrl, setShareUrl] = useState('')
  const [watch, setWatch] = useState<WatchConfig>({
    enabled: false,
    path: '',
    kb_id: 'default',
    poll_seconds: 5,
  })
  const [watchSaving, setWatchSaving] = useState(false)
  const activeKb = kbs.find((k) => k.id === kbId)

  useEffect(() => {
    if (!settings) return
    setProvider(settings.provider)
    setBaseUrl(settings.base_url)
    setChatModel(settings.chat_model)
    setEmbeddingModel(settings.embedding_model)
    setApiKey('')
  }, [settings])

  useEffect(() => {
    void fetchWatchConfig()
      .then(setWatch)
      .catch(() => undefined)
  }, [])

  async function onSave() {
    if (locked) {
      setStatus('设置已被环境变量锁定（RAGDESK_LOCK_SETTINGS）')
      return
    }
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
      if (!locked) {
        await saveSettings({
          provider,
          base_url: baseUrl,
          chat_model: chatModel,
          embedding_model: embeddingModel,
          ...(apiKey ? { api_key: apiKey } : {}),
        })
      }
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

  async function onSaveWatch() {
    setWatchSaving(true)
    try {
      const next = await saveWatchConfig(watch)
      setWatch(next)
      setStatus(
        next.enabled
          ? `已开启监视：${next.path || '（请填写路径）'}`
          : '已关闭监视文件夹',
      )
    } catch (err) {
      setStatus(err instanceof Error ? err.message : '监视配置保存失败')
    } finally {
      setWatchSaving(false)
    }
  }

  async function onExportKb() {
    try {
      const blob = await exportKnowledgeBase(kbId)
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `ragdesk-kb-${kbId}.zip`
      a.click()
      URL.revokeObjectURL(a.href)
      setStatus(`已导出知识库 ${kbId}`)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : '导出失败')
    }
  }

  async function onImportKb(file: File | null) {
    if (!file) return
    try {
      const result = await importKnowledgeBase(file)
      setStatus(
        `已导入知识库：${result.kb.name}（${result.imported} 份文档）`,
      )
      onKbMeta()
    } catch (err) {
      setStatus(err instanceof Error ? err.message : '导入失败')
    }
  }

  async function onToggleReadonly() {
    if (!activeKb) return
    try {
      await setKnowledgeBaseReadonly(kbId, !activeKb.readonly)
      setStatus(
        activeKb.readonly
          ? `已取消只读：${activeKb.name}`
          : `已设为只读：${activeKb.name}`,
      )
      onKbMeta()
    } catch (err) {
      setStatus(err instanceof Error ? err.message : '更新只读失败')
    }
  }

  return (
    <section className="panel">
      <div className="panel__head">
        <div>
          <h2>设置</h2>
          <p>
            切换 Mock、OpenAI 兼容接口或 Ollama。密钥只保存在本机，不会上传。
            {locked ? ' 当前由环境变量锁定，无法在此修改模型配置。' : ''}
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
            disabled={saving || !settings || locked}
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

      {settings?.api_token_required ? (
        <div className="probe">
          <strong>需要 API Token</strong>
          <span>
            服务端已设置 RAGDESK_API_TOKEN。请在下方填写并保存到本浏览器。
          </span>
        </div>
      ) : null}

      <div className="form-grid">
        <MantineTextInput
          className="desk-field span-2"
          classNames={{
            root: 'desk-field__root',
            label: 'desk-field__label',
            input: 'desk-field__input',
          }}
          label="客户端 API Token（Bearer）"
          type="password"
          value={clientToken}
          onChange={(e) => setClientToken(e.currentTarget.value)}
          placeholder="与 RAGDESK_API_TOKEN 一致"
          autoComplete="off"
          size="md"
          rightSectionWidth={72}
          rightSection={
            <button
              type="button"
              className="btn btn--ghost"
              style={{ height: '1.8rem', paddingInline: '0.5rem' }}
              onClick={() => {
                setApiToken(clientToken)
                setStatus(
                  clientToken.trim()
                    ? '已保存客户端 Token'
                    : '已清除客户端 Token',
                )
              }}
            >
              保存
            </button>
          }
        />
        <div className="desk-field">
          <DeskSelect
            tone="light"
            label="Provider"
            aria-label="Provider"
            value={provider}
            disabled={locked}
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
        </div>
        <MantineTextInput
          className="desk-field"
          classNames={{
            root: 'desk-field__root',
            label: 'desk-field__label',
            input: 'desk-field__input',
          }}
          label="Base URL"
          value={baseUrl}
          disabled={locked}
          onChange={(e) => setBaseUrl(e.currentTarget.value)}
          placeholder={
            provider === 'ollama'
              ? 'http://127.0.0.1:11434'
              : 'https://api.openai.com/v1'
          }
          size="md"
        />
        <MantineTextInput
          className="desk-field"
          classNames={{
            root: 'desk-field__root',
            label: 'desk-field__label',
            input: 'desk-field__input',
          }}
          label="Chat Model"
          list="chat-model-options"
          value={chatModel}
          disabled={locked}
          onChange={(e) => setChatModel(e.currentTarget.value)}
          placeholder="gpt-4o-mini / llama3.2"
          size="md"
        />
        <datalist id="chat-model-options">
          {(probe?.chat_models ?? []).map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
        <MantineTextInput
          className="desk-field"
          classNames={{
            root: 'desk-field__root',
            label: 'desk-field__label',
            input: 'desk-field__input',
          }}
          label="Embedding Model"
          list="embed-model-options"
          value={embeddingModel}
          disabled={locked}
          onChange={(e) => setEmbeddingModel(e.currentTarget.value)}
          placeholder="text-embedding-3-small / nomic-embed-text"
          size="md"
        />
        <datalist id="embed-model-options">
          {(probe?.embedding_models ?? []).map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
        <MantineTextInput
          className="desk-field span-2"
          classNames={{
            root: 'desk-field__root',
            label: 'desk-field__label',
            input: 'desk-field__input',
          }}
          label={
            settings?.api_key_set
              ? 'API Key（已设置，留空则保持不变）'
              : 'API Key'
          }
          type="password"
          value={apiKey}
          disabled={locked}
          onChange={(e) => setApiKey(e.currentTarget.value)}
          placeholder="sk-..."
          autoComplete="off"
          size="md"
        />
      </div>

      <div className="panel__subhead">
        <h3>监视文件夹</h3>
        <p>轮询本地目录，自动入库新增的 md/txt/pdf/docx/xlsx。</p>
      </div>
      <div className="form-grid">
        <label className="check-row span-2">
          <input
            type="checkbox"
            checked={watch.enabled}
            onChange={(e) =>
              setWatch((w) => ({ ...w, enabled: e.currentTarget.checked }))
            }
          />
          启用监视
        </label>
        <MantineTextInput
          className="desk-field span-2"
          classNames={{
            root: 'desk-field__root',
            label: 'desk-field__label',
            input: 'desk-field__input',
          }}
          label="监视路径（服务端本机绝对路径）"
          value={watch.path}
          onChange={(e) =>
            setWatch((w) => ({ ...w, path: e.currentTarget.value }))
          }
          placeholder="D:\\docs\\inbox"
          size="md"
        />
        <div className="desk-field">
          <DeskSelect
            tone="light"
            label="入库到知识库"
            aria-label="监视知识库"
            value={watch.kb_id || 'default'}
            data={kbs.map((k) => ({
              value: k.id,
              label: k.readonly ? `${k.name}（只读）` : k.name,
            }))}
            onChange={(v) => setWatch((w) => ({ ...w, kb_id: v || 'default' }))}
          />
        </div>
        <MantineTextInput
          className="desk-field"
          classNames={{
            root: 'desk-field__root',
            label: 'desk-field__label',
            input: 'desk-field__input',
          }}
          label="轮询秒数"
          type="number"
          value={String(watch.poll_seconds)}
          onChange={(e) =>
            setWatch((w) => ({
              ...w,
              poll_seconds: Math.max(2, Number(e.currentTarget.value) || 5),
            }))
          }
          size="md"
        />
        <div className="span-2">
          <button
            type="button"
            className="btn btn--primary"
            disabled={watchSaving}
            onClick={() => void onSaveWatch()}
          >
            {watchSaving ? '保存中…' : '保存监视配置'}
          </button>
        </div>
      </div>

      <div className="panel__subhead">
        <h3>当前知识库</h3>
        <p>
          {activeKb
            ? `${activeKb.name}${activeKb.readonly ? '（只读）' : ''}`
            : kbId}
        </p>
      </div>
      <div className="panel__actions" style={{ justifyContent: 'flex-start' }}>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => void onExportKb()}
        >
          导出 ZIP
        </button>
        <label className="btn btn--ghost">
          导入 ZIP
          <input
            type="file"
            accept=".zip,application/zip"
            hidden
            onChange={(e) => {
              void onImportKb(e.currentTarget.files?.[0] || null)
              e.currentTarget.value = ''
            }}
          />
        </label>
        <button
          type="button"
          className="btn btn--ghost"
          disabled={!activeKb}
          onClick={() => void onToggleReadonly()}
        >
          {activeKb?.readonly ? '取消只读' : '设为只读'}
        </button>
      </div>
    </section>
  )
}
