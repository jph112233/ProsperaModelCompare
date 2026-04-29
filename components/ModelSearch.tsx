'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface ORModel {
  id: string
  name: string
  pricing: { prompt: string; completion: string }
  context_length: number
}

// Module-level cache so we only fetch once per page load
let cachedModels: ORModel[] | null = null
let fetchPromise: Promise<ORModel[]> | null = null

async function fetchModels(): Promise<ORModel[]> {
  if (cachedModels) return cachedModels
  if (fetchPromise) return fetchPromise

  fetchPromise = fetch('https://openrouter.ai/api/v1/models')
    .then((r) => r.json())
    .then((json) => {
      const models = (json.data as ORModel[]) ?? []
      models.sort((a, b) => a.id.localeCompare(b.id))
      cachedModels = models
      return models
    })
    .catch(() => [])

  return fetchPromise
}

function formatPrice(perToken: string): string {
  const n = parseFloat(perToken)
  if (n === 0) return 'free'
  const perM = n * 1_000_000
  return `$${perM < 0.01 ? perM.toFixed(3) : perM.toFixed(2)}/M`
}

interface ModelSearchProps {
  value: string
  onChange: (v: string) => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
  placeholder?: string
  className?: string
}

export default function ModelSearch({ value, onChange, onKeyDown, placeholder, className }: ModelSearchProps) {
  const [models, setModels] = useState<ORModel[]>(cachedModels ?? [])
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)
  const [activeIdx, setActiveIdx] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync external value changes into query when closed
  useEffect(() => {
    if (!open) setQuery(value)
  }, [value, open])

  // Prefetch on mount
  useEffect(() => {
    if (!cachedModels) {
      fetchModels().then((m) => setModels(m))
    }
  }, [])

  // Outside click closes
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery(value)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, value])

  const filtered = useCallback((): ORModel[] => {
    if (!query.trim()) return models.slice(0, 80)
    const q = query.toLowerCase()
    return models
      .filter((m) => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q))
      .slice(0, 80)
  }, [query, models])

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setQuery(v)
    onChange(v)
    setOpen(true)
    setActiveIdx(0)
  }

  function handleSelect(model: ORModel) {
    onChange(model.id)
    setQuery(model.id)
    setOpen(false)
  }

  function handleKeyDownInternal(e: React.KeyboardEvent<HTMLInputElement>) {
    const items = filtered()
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActiveIdx((i) => Math.min(i + 1, items.length - 1))
      scrollActive()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, 0))
      scrollActive()
    } else if (e.key === 'Enter' && open && items[activeIdx]) {
      e.preventDefault()
      handleSelect(items[activeIdx])
    } else if (e.key === 'Escape') {
      setOpen(false)
      setQuery(value)
    } else {
      onKeyDown?.(e)
    }
  }

  function scrollActive() {
    requestAnimationFrame(() => {
      const el = listRef.current?.querySelector('[data-active="true"]') as HTMLElement | null
      el?.scrollIntoView({ block: 'nearest' })
    })
  }

  const items = open ? filtered() : []

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={handleInputChange}
        onFocus={() => { fetchModels().then(setModels); setOpen(true); setActiveIdx(0) }}
        onKeyDown={handleKeyDownInternal}
        placeholder={placeholder ?? 'openai/gpt-4o-mini'}
        className={className ?? `w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm
          text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition-colors`}
        autoComplete="off"
        spellCheck={false}
      />

      {open && items.length > 0 && (
        <ul
          ref={listRef}
          className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto bg-slate-800 border
            border-slate-600 rounded-lg shadow-2xl"
        >
          {items.map((m, i) => (
            <li
              key={m.id}
              data-active={i === activeIdx ? 'true' : undefined}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(m) }}
              onMouseEnter={() => setActiveIdx(i)}
              className={`flex items-start justify-between gap-3 px-3 py-2 cursor-pointer transition-colors ${
                i === activeIdx ? 'bg-slate-700' : 'hover:bg-slate-750'
              }`}
            >
              <div className="min-w-0">
                <div className="text-xs font-mono text-slate-200 truncate">{m.id}</div>
                <div className="text-xs text-slate-500 truncate">{m.name}</div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className={`text-xs ${parseFloat(m.pricing.prompt) === 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                  {formatPrice(m.pricing.prompt)}
                </div>
                <div className="text-xs text-slate-600">
                  {(m.context_length / 1000).toFixed(0)}k ctx
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
