'use client'

import { useState, useCallback, useImperativeHandle, forwardRef, useEffect } from 'react'
import type { RequestConfig, CompletionResult } from '@/lib/api'
import { runCompletion } from '@/lib/api'
import type { ComparePreset } from '@/lib/presets'
import type { PersistedColumn } from '@/lib/storage'
import ConfigPanel from './ConfigPanel'
import OutputPanel from './OutputPanel'
import ModelSearch from './ModelSearch'
import ExpandableTextarea from './ExpandableTextarea'

export interface CompareViewHandle {
  getState: () => ComparePreset
  loadState: (preset: ComparePreset) => void
}

interface CompareViewProps {
  initialConfig: RequestConfig
  onConfigChange: (patch: Partial<RequestConfig>) => void
  onStateChange?: (columns: PersistedColumn[]) => void
  initialColumns?: PersistedColumn[]
}

interface ModelColumn {
  id: string
  model: string
  result: CompletionResult | null
  loading: boolean
}

let nextId = 1
function uid() { return String(nextId++) }

const CompareView = forwardRef<CompareViewHandle, CompareViewProps>(function CompareView(
  { initialConfig, onConfigChange, onStateChange, initialColumns },
  ref
) {
  // All shared settings live here - everything except model
  const [shared, setShared] = useState<RequestConfig>({ ...initialConfig, model: '' })

  const [columns, setColumns] = useState<ModelColumn[]>(() => {
    if (initialColumns && initialColumns.length > 0) {
      return initialColumns.map((c) => ({ id: uid(), model: c.model, result: c.result, loading: false }))
    }
    return [
      { id: uid(), model: '', result: null, loading: false },
      { id: uid(), model: '', result: null, loading: false },
    ]
  })

  useImperativeHandle(ref, () => ({
    getState(): ComparePreset {
      return {
        mode: 'compare',
        shared,
        columns: columns.map((c) => ({ model: c.model, result: c.result })),
      }
    },
    loadState(preset: ComparePreset) {
      setShared({ ...preset.shared, model: '' })
      setColumns(preset.columns.map((c) => ({
        id: uid(),
        model: c.model,
        result: c.result,
        loading: false,
      })))
    },
  }))

  useEffect(() => {
    if (!onStateChange) return
    onStateChange(columns.map((c) => ({ model: c.model, result: c.result })))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns])

  const anyLoading = columns.some((c) => c.loading)

  function updateShared(patch: Partial<RequestConfig>) {
    setShared((s) => ({ ...s, ...patch }))
    onConfigChange(patch)
  }

  function setModel(id: string, model: string) {
    setColumns((cols) => cols.map((c) => c.id === id ? { ...c, model } : c))
  }

  function addColumn() {
    setColumns((cols) => [...cols, { id: uid(), model: '', result: null, loading: false }])
  }

  function removeColumn(id: string) {
    setColumns((cols) => cols.filter((c) => c.id !== id))
  }

  const runAll = useCallback(async () => {
    // Mark all loading, clear results
    setColumns((cols) => cols.map((c) => ({ ...c, loading: true, result: null })))

    // Capture snapshot of models + shared config
    setColumns((cols) => {
      const snapshot = cols.map((c) => ({ id: c.id, model: c.model }))
      const sharedSnapshot = shared

      Promise.all(
        snapshot.map(({ id, model }) =>
          runCompletion({ ...sharedSnapshot, model }).then((result) => ({ id, result }))
        )
      ).then((results) => {
        setColumns((current) =>
          current.map((c) => {
            const match = results.find((r) => r.id === c.id)
            return match ? { ...c, result: match.result, loading: false } : c
          })
        )
      })

      return cols
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shared])

  const runOne = useCallback((id: string) => {
    setColumns((cols) => {
      const col = cols.find((c) => c.id === id)
      if (!col) return cols
      const sharedSnapshot = shared
      const model = col.model
      runCompletion({ ...sharedSnapshot, model }).then((result) => {
        setColumns((current) =>
          current.map((c) => c.id === id ? { ...c, result, loading: false } : c)
        )
      })
      return cols.map((c) => c.id === id ? { ...c, loading: true, result: null } : c)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shared])

  const [panelCollapsed, setPanelCollapsed] = useState(false)

  function colConfig(col: ModelColumn): RequestConfig {
    return { ...shared, model: col.model }
  }

  const COL_WIDTH = 520

  return (
    <div className="flex gap-0 h-full min-h-0">
      {/* Left: collapsible shared settings panel */}
      <div
        className={`flex-shrink-0 transition-all duration-200 overflow-hidden ${
          panelCollapsed ? 'w-10' : 'w-[320px]'
        }`}
      >
        {panelCollapsed ? (
          <div className="flex flex-col items-center pt-2 gap-2">
            <button
              onClick={() => setPanelCollapsed(false)}
              className="w-8 h-8 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700
                text-slate-400 hover:text-slate-200 transition-colors flex items-center justify-center"
              title="Expand settings"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <div className="writing-vertical text-xs text-slate-600 mt-2 select-none" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
              Settings
            </div>
          </div>
        ) : (
          <div className="relative overflow-y-auto h-full pr-2">
            <button
              onClick={() => setPanelCollapsed(true)}
              className="absolute top-2 right-3 z-10 w-6 h-6 rounded bg-slate-800 hover:bg-slate-700
                text-slate-500 hover:text-slate-300 transition-colors flex items-center justify-center"
              title="Collapse settings"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <ConfigPanel
              config={shared}
              onChange={updateShared}
              onRun={runAll}
              running={anyLoading}
              hideModel
              runLabel={`Run All (${columns.length})`}
            />
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="w-px bg-slate-800 flex-shrink-0 mx-3" />

      {/* Right: horizontally-scrollable model columns */}
      <div className="flex-1 min-w-0 overflow-x-auto">
        <div className="flex gap-4 pb-4" style={{ width: 'max-content', minWidth: '100%' }}>
          {columns.map((col, idx) => (
            <div key={col.id} className="flex flex-col gap-2 flex-shrink-0" style={{ width: COL_WIDTH }}>
              {/* Model header */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex-shrink-0">
                  {idx + 1}
                </span>
                <ModelSearch
                  value={col.model}
                  onChange={(v) => setModel(col.id, v)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) runAll()
                  }}
                  className="flex-1 bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-sm
                    text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500
                    transition-colors w-full"
                />
                <button
                  onClick={() => runOne(col.id)}
                  disabled={col.loading}
                  className="text-slate-600 hover:text-emerald-400 disabled:text-slate-700 transition-colors flex-shrink-0"
                  title="Run this model"
                >
                  {col.loading ? (
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  )}
                </button>
                {columns.length > 1 && (
                  <button
                    onClick={() => removeColumn(col.id)}
                    className="text-slate-600 hover:text-slate-400 transition-colors flex-shrink-0"
                    title="Remove"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Output */}
              <div className="min-h-[600px]">
                <OutputPanel result={col.result} loading={col.loading} config={colConfig(col)} />
              </div>
            </div>
          ))}

          {/* Add column button */}
          <div className="flex flex-col justify-start pt-0.5 flex-shrink-0">
            <button
              onClick={addColumn}
              className="h-9 w-9 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600
                hover:border-slate-500 text-slate-400 hover:text-slate-200 transition-colors
                flex items-center justify-center"
              title="Add model"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
})

export default CompareView
