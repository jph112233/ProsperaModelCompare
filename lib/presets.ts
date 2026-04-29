import type { RequestConfig, CompletionResult, Attachment } from './api'

export interface SinglePreset {
  mode: 'single'
  config: RequestConfig
  result: CompletionResult | null
}

export interface CompareColumn {
  model: string
  result: CompletionResult | null
}

export interface ComparePreset {
  mode: 'compare'
  shared: Omit<RequestConfig, 'model'>
  columns: CompareColumn[]
}

export type PresetData = SinglePreset | ComparePreset

export interface Preset {
  id: string
  name: string
  savedAt: string
  data: PresetData
}

const KEY = 'llm-playground:presets'

// Strip fields that bloat storage: raw response string, request payload blob,
// and base64 attachment data (keep metadata so the UI can show what was attached).
function slimResult(result: CompletionResult | null): CompletionResult | null {
  if (!result) return null
  // Drop `raw` (redundant with `parsed`) and `payload` (can contain base64 images)
  const { raw: _raw, payload: _payload, ...slim } = result
  return slim as CompletionResult
}

function slimAttachments(attachments: Attachment[]): Attachment[] {
  return attachments.map(({ dataUrl: _dataUrl, text: _text, ...meta }) => ({
    ...meta,
    dataUrl: '',  // cleared - not needed for display in saved preset
  }))
}

function slimConfig(config: RequestConfig): RequestConfig {
  return { ...config, attachments: slimAttachments(config.attachments) }
}

function slimData(data: PresetData): PresetData {
  if (data.mode === 'single') {
    return {
      mode: 'single',
      config: slimConfig(data.config),
      result: slimResult(data.result),
    }
  }
  return {
    mode: 'compare',
    shared: { ...data.shared, attachments: slimAttachments(data.shared.attachments) },
    columns: data.columns.map((c) => ({ ...c, result: slimResult(c.result) })),
  }
}

export function loadPresets(): Preset[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    return JSON.parse(raw) as Preset[]
  } catch {
    return []
  }
}

function writePresets(presets: Preset[]): void {
  const json = JSON.stringify(presets)
  try {
    localStorage.setItem(KEY, json)
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      // Drop results from the oldest half and retry once
      const trimmed = presets.map((p) => ({
        ...p,
        data: p.data.mode === 'single'
          ? { ...p.data, result: null }
          : {
              ...p.data,
              columns: (p.data as ComparePreset).columns.map((c) => ({ ...c, result: null })),
            },
      }))
      try {
        localStorage.setItem(KEY, JSON.stringify(trimmed))
      } catch {
        // Still over quota - drop oldest presets until it fits
        for (let i = trimmed.length - 1; i > 0; i--) {
          try {
            localStorage.setItem(KEY, JSON.stringify(trimmed.slice(0, i)))
            return
          } catch { /* keep trimming */ }
        }
      }
    } else {
      throw e
    }
  }
}

export function savePreset(name: string, data: PresetData): Preset {
  const preset: Preset = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    savedAt: new Date().toISOString(),
    data: slimData(data),
  }
  const existing = loadPresets()
  writePresets([preset, ...existing])
  return preset
}

export function deletePreset(id: string): void {
  writePresets(loadPresets().filter((p) => p.id !== id))
}

export function updatePresetName(id: string, name: string): void {
  writePresets(loadPresets().map((p) => p.id === id ? { ...p, name } : p))
}
