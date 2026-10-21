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
  status: 'ready' | 'error'
  chunk_count: number
  error: string | null
  created_at: string
}

export type Citation = {
  document_id: string
  filename: string
  excerpt: string
  score: number | null
}

export type ChatMessage = {
  role: 'user' | 'assistant' | 'system'
  content: string
  citations?: Citation[]
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

export async function fetchSettings(): Promise<Settings> {
  const res = await fetch('/api/settings')
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
  const res = await fetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

export async function listDocuments(): Promise<DocumentInfo[]> {
  const res = await fetch('/api/documents')
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

export async function uploadDocument(file: File): Promise<DocumentInfo> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch('/api/documents', { method: 'POST', body: form })
  if (!res.ok) throw new Error(await readError(res))
  return res.json()
}

export async function deleteDocument(id: string): Promise<void> {
  const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await readError(res))
}

export type ReindexResult = {
  total: number
  rebuilt: number
  failed: number
  documents: DocumentInfo[]
}

export async function reindexDocuments(): Promise<ReindexResult> {
  const res = await fetch('/api/documents/reindex', { method: 'POST' })
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
  const res = await fetch('/api/provider/status')
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
): Promise<void> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, top_k: topK }),
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
      const line = chunk
        .split('\n')
        .find((l) => l.startsWith('data: '))
      if (!line) continue
      const payload = line.slice(6)
      try {
        onEvent(JSON.parse(payload))
      } catch {
        // ignore malformed
      }
    }
  }
}
