import type { RequestConfig, CompletionResult } from './api'

const KEY = 'llm-playground:v1'
const SESSION_KEY = 'llm-playground:session'

type PersistedConfig = Omit<RequestConfig, 'userPrompt' | 'attachments'>

const defaults: PersistedConfig = {
  apiKey: '',
  baseUrl: 'https://openrouter.ai/api/v1',
  model: '',
  systemPrompt: '',
  temperature: 0.7,
  maxTokens: 1024,
  topP: 1,
  frequencyPenalty: 0,
  presencePenalty: 0,
  seed: '',
  responseFormat: 'text',
  jsonSchemaText: '',
}

export function loadPersisted(): PersistedConfig {
  if (typeof window === 'undefined') return { ...defaults }
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...defaults }
    return { ...defaults, ...JSON.parse(raw) }
  } catch {
    return { ...defaults }
  }
}

export function savePersisted(patch: Partial<PersistedConfig>): void {
  if (typeof window === 'undefined') return
  try {
    const current = loadPersisted()
    localStorage.setItem(KEY, JSON.stringify({ ...current, ...patch }))
  } catch {
    // storage unavailable
  }
}

export interface PersistedColumn {
  model: string
  result: CompletionResult | null
}

export interface SessionData {
  compareMode: boolean
  result: CompletionResult | null
  compareColumns: PersistedColumn[]
}

const sessionDefaults: SessionData = {
  compareMode: false,
  result: null,
  compareColumns: [{ model: '', result: null }, { model: '', result: null }],
}

export function loadSession(): SessionData {
  if (typeof window === 'undefined') return { ...sessionDefaults }
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return { ...sessionDefaults }
    return { ...sessionDefaults, ...JSON.parse(raw) }
  } catch {
    return { ...sessionDefaults }
  }
}

export function saveSession(patch: Partial<SessionData>): void {
  if (typeof window === 'undefined') return
  try {
    const current = loadSession()
    localStorage.setItem(SESSION_KEY, JSON.stringify({ ...current, ...patch }))
  } catch {
    // storage quota exceeded or unavailable - silently ignore
  }
}
