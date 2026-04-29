'use client'

import { useState, useEffect, useRef } from 'react'
import type { Preset, PresetData } from '@/lib/presets'
import { loadPresets, savePreset, deletePreset, updatePresetName, overwritePreset } from '@/lib/presets'

interface PresetsPanelProps {
  onGetCurrentState: () => PresetData
  onLoadPreset: (data: PresetData) => void
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function PresetBadge({ data }: { data: PresetData }) {
  if (data.mode === 'single') {
    return (
      <span className="text-xs bg-slate-700 text-slate-400 rounded px-1.5 py-0.5">
        {data.config.model || 'no model'}
      </span>
    )
  }
  return (
    <div className="flex flex-wrap gap-1">
      {data.columns.map((c, i) => (
        <span key={i} className="text-xs bg-slate-700 text-slate-400 rounded px-1.5 py-0.5">
          {c.model || 'no model'}
        </span>
      ))}
    </div>
  )
}

export default function PresetsPanel({ onGetCurrentState, onLoadPreset }: PresetsPanelProps) {
  const [open, setOpen] = useState(false)
  const [presets, setPresets] = useState<Preset[]>([])
  const [saving, setSaving] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const panelRef = useRef<HTMLDivElement>(null)
  const saveInputRef = useRef<HTMLInputElement>(null)

  function refresh() {
    setPresets(loadPresets())
  }

  useEffect(() => {
    if (open) refresh()
  }, [open])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    if (saving) saveInputRef.current?.focus()
  }, [saving])

  function handleSave() {
    const name = saveName.trim()
    if (!name) return
    const data = onGetCurrentState()
    savePreset(name, data)
    setSaveName('')
    setSaving(false)
    refresh()
  }

  function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    deletePreset(id)
    refresh()
  }

  function handleRename(id: string) {
    const name = editingName.trim()
    if (name) updatePresetName(id, name)
    setEditingId(null)
    setEditingName('')
    refresh()
  }

  function handleOverwrite(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    const data = onGetCurrentState()
    overwritePreset(id, data)
    refresh()
  }

  function handleLoad(data: PresetData) {
    onLoadPreset(data)
    setOpen(false)
  }

  const modeLabel = (data: PresetData) => data.mode === 'compare'
    ? `Compare (${(data as import('@/lib/presets').ComparePreset).columns.length})`
    : 'Single'

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
          open
            ? 'bg-slate-700 text-slate-200'
            : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200'
        }`}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8l1 12a2 2 0 002 2h8a2 2 0 002-2l1-12" />
        </svg>
        Presets
        {presets.length > 0 && (
          <span className="text-xs bg-emerald-700 text-emerald-100 rounded-full px-1.5 py-0.5 leading-none">
            {presets.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-slate-900 border border-slate-700 rounded-lg
          shadow-2xl z-50 flex flex-col overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
            <h2 className="text-sm font-semibold text-slate-200">Saved Presets</h2>
            <button
              onClick={() => { setSaving(true); setSaveName('') }}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500
                text-white rounded font-medium transition-colors"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Save current
            </button>
          </div>

          {/* Save row */}
          {saving && (
            <div className="px-4 py-3 border-b border-slate-700 bg-slate-800 flex gap-2">
              <input
                ref={saveInputRef}
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave()
                  if (e.key === 'Escape') { setSaving(false); setSaveName('') }
                }}
                placeholder="Preset name..."
                className="flex-1 bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-sm
                  text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
              />
              <button
                onClick={handleSave}
                disabled={!saveName.trim()}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700
                  disabled:text-slate-500 text-white text-sm font-medium rounded transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => { setSaving(false); setSaveName('') }}
                className="px-2 py-1.5 text-slate-500 hover:text-slate-300 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* List */}
          <div className="overflow-y-auto max-h-[420px]">
            {presets.length === 0 ? (
              <div className="px-4 py-8 text-center text-slate-600 text-sm">
                No presets saved yet.
              </div>
            ) : (
              presets.map((preset) => (
                <div
                  key={preset.id}
                  className="px-4 py-3 border-b border-slate-800 hover:bg-slate-800 transition-colors
                    cursor-pointer group"
                  onClick={() => handleLoad(preset.data)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {editingId === preset.id ? (
                        <input
                          type="text"
                          value={editingName}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            e.stopPropagation()
                            if (e.key === 'Enter') handleRename(preset.id)
                            if (e.key === 'Escape') { setEditingId(null) }
                          }}
                          onBlur={() => handleRename(preset.id)}
                          autoFocus
                          className="w-full bg-slate-700 border border-slate-500 rounded px-2 py-0.5
                            text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-200 truncate">{preset.name}</span>
                          <span className="text-xs text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded flex-shrink-0">
                            {modeLabel(preset.data)}
                          </span>
                        </div>
                      )}
                      <div className="mt-1.5">
                        <PresetBadge data={preset.data} />
                      </div>
                      <div className="text-xs text-slate-600 mt-1">{formatDate(preset.savedAt)}</div>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button
                        onClick={(e) => handleOverwrite(preset.id, e)}
                        className="p-1 text-slate-500 hover:text-emerald-400 transition-colors"
                        title="Save current state over this preset"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingId(preset.id)
                          setEditingName(preset.name)
                        }}
                        className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
                        title="Rename"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => handleDelete(preset.id, e)}
                        className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                        title="Delete"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
