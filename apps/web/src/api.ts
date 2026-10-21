export type ProviderName = 'openai_compat' | 'ollama' | 'mock'

export type Settings = {
  provider: ProviderName
  base_url: string
  chat_model: string
  embedding_model: string
  api_key_set: boolean
  has_documents: boolean
}

export type DocumentInfo = {
  id: string
  filename: string
  size: number
  status: 'ready' | 'error' | 'processing'
  chunk_count: number
  error: string | null
  created_at: string
}

export type Citation = {
  document_id: string
  filename: string
  excerpt: string
  score: number | null
  chunk_index?: number | null
}

export type ChatMessage = {
  role: 'user' | 'assistant' | 'system'
  content: string
  citations?: Citation[]
}

let activeKbId = localStorage.getItem('ragdesk:kb') || 'default'

export function getActiveKbId() {
  return activeKbId
}

export function setActiveKbId(id: string) {
  activeKbId = id
  localStorage.setItem('ragdesk:kb', id)
}

async function readError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { detail?: string }
    if (typeof data?.detail === 'string') return data.detail
    return JSON.stringify(data)
  } catch {
    return res.statusText
  }
}

async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {})
  headers.set('X-Ragdesk-KB', activeKbId)
  return fetch(input, { ...init, headers })
}

export type KnowledgeBase = { id: string; name: string }

export async function listKnowledgeBases(): Promise<KnowledgeBase[]> {
  const res = await apiFetch('/api/kbs')
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

export async function createKnowledgeBase(name: string): Promise<KnowledgeBase> {
  const res = await apiFetch('/api/kbs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

export async function fetchSettings(): Promise<Settings> {
  const res = await apiFetch('/api/settings')
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

export async function saveSettings(
  body: Partial<{
    provider: ProviderName
    base_url: string
    api_key: string
    chat_model: string
    embedding_model: string
  }>,
): Promise<Settings> {
  const res = await apiFetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

export async function listDocuments(): Promise<DocumentInfo[]> {
  const res = await apiFetch('/api/documents')
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

export async function uploadDocument(file: File): Promise<DocumentInfo> {
  const form = new FormData()
  form.append('file', file)
  const res = await apiFetch('/api/documents', { method: 'POST', body: form })
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

export type UploadStageEvent = {
  type: 'stage' | 'done' | 'error'
  stage?: string
  detail?: string
  chunk_count?: number
  message?: string
  document?: DocumentInfo
}

export async function uploadDocumentStream(
  file: File,
  onEvent: (event: UploadStageEvent) => void,
): Promise<DocumentInfo> {
  const form = new FormData()
  form.append('file', file)
  const res = await apiFetch('/api/documents/upload-stream', {
    method: 'POST',
    body: form,
  })
  if (!res.ok) throw new Error(await readError(res))
  if (!res.body) throw new Error('No response body')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let result: DocumentInfo | null = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''
    for (const part of parts) {
      const line = part.split('\n').find((l) => l.startsWith('data: '))
      if (!line) continue
      const event = JSON.parse(line.slice(6)) as UploadStageEvent
      onEvent(event)
      if (event.type === 'done' && event.document) result = event.document
      if (event.type === 'error') {
        throw new Error(event.message || event.document?.error || '上传失败')
      }
    }
  }
  if (!result) throw new Error('上传未返回文档结果')
  return result
}

export async function importSampleDocument(): Promise<DocumentInfo> {
  const res = await apiFetch('/api/documents/sample', { method: 'POST' })
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

export async function deleteDocument(id: string): Promise<void> {
  const res = await apiFetch(`/api/documents/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await readError(res))
}

export type ReindexResult = {
  total: number
  rebuilt: number
  failed: number
  documents: DocumentInfo[]
}

export async function reindexDocuments(): Promise<ReindexResult> {
  const res = await apiFetch('/api/documents/reindex', { method: 'POST' })
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

export type ProviderStatus = {
  provider: ProviderName
  ok: boolean
  message: string
  base_url: string
  chat_models: string[]
  embedding_models: string[]
}

export async function fetchProviderStatus(): Promise<ProviderStatus> {
  const res = await apiFetch('/api/provider/status')
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

export async function streamChat(
  messages: { role: string; content: string }[],
  topK: number,
  onEvent: (event: {
    type: string
    content?: string
    citations?: Citation[]
  }) => void,
  signal?: AbortSignal,
  mode: 'rag' | 'agent' = 'rag',
): Promise<void> {
  const res = await apiFetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, top_k: topK, mode }),
    signal,
  })
  if (!res.ok) throw new Error(await readError(res))
  if (!res.body) throw new Error('No response body')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const chunks = buffer.split('\n\n')
    buffer = chunks.pop() ?? ''
    for (const chunk of chunks) {
      const line = chunk.split('\n').find((l) => l.startsWith('data: '))
      if (!line) continue
      try {
        onEvent(JSON.parse(line.slice(6)))
      } catch {
        // ignore
      }
    }
  }
}
