'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { RequestConfig, CompletionResult } from '@/lib/api'
import { runCompletion } from '@/lib/api'
import { loadPersisted, savePersisted, loadSession, saveSession } from '@/lib/storage'
import type { PersistedColumn } from '@/lib/storage'
import type { PresetData } from '@/lib/presets'
import ConfigPanel from '@/components/ConfigPanel'
import OutputPanel from '@/components/OutputPanel'
import CompareView, { type CompareViewHandle } from '@/components/CompareView'
import PresetsPanel from '@/components/PresetsPanel'

const DEFAULT_CONFIG: RequestConfig = {
  apiKey: '',
  baseUrl: 'https://openrouter.ai/api/v1',
  model: '',
  systemPrompt: '',
  userPrompt: '',
  temperature: 0.7,
  maxTokens: 1024,
  topP: 1,
  frequencyPenalty: 0,
  presencePenalty: 0,
  seed: '',
  responseFormat: 'text',
  jsonSchemaText: '',
  attachments: [],
}

export default function Home() {
  const [compareMode, setCompareMode] = useState(false)
  const [config, setConfig] = useState<RequestConfig>(DEFAULT_CONFIG)
  const [result, setResult] = useState<CompletionResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [initialCompareColumns, setInitialCompareColumns] = useState<PersistedColumn[] | undefined>(undefined)
  const compareRef = useRef<CompareViewHandle>(null)

  useEffect(() => {
    const persisted = loadPersisted()
    const session = loadSession()
    setConfig((c) => ({ ...c, ...persisted }))
    setCompareMode(session.compareMode)
    setResult(session.result)
    setInitialCompareColumns(session.compareColumns)
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { userPrompt: _up, attachments: _att, ...rest } = config
    savePersisted(rest)
  }, [config, hydrated])

  useEffect(() => {
    if (!hydrated) return
    saveSession({ compareMode })
  }, [compareMode, hydrated])

  useEffect(() => {
    if (!hydrated) return
    saveSession({ result })
  }, [result, hydrated])

  const handleChange = useCallback((patch: Partial<RequestConfig>) => {
    setConfig((c) => ({ ...c, ...patch }))
  }, [])

  const handleCompareStateChange = useCallback((columns: PersistedColumn[]) => {
    saveSession({ compareColumns: columns })
  }, [])

  const handleRun = useCallback(async () => {
    setLoading(true)
    setResult(null)
    const r = await runCompletion(config)
    setResult(r)
    setLoading(false)
  }, [config])

  function getCurrentState(): PresetData {
    if (compareMode && compareRef.current) {
      return compareRef.current.getState()
    }
    return { mode: 'single', config, result }
  }

  function loadPreset(data: PresetData) {
    if (data.mode === 'single') {
      setCompareMode(false)
      setConfig(data.config)
      setResult(data.result)
    } else {
      setCompareMode(true)
      // shared config fields flow into config state for persistence
      setConfig((c) => ({ ...c, ...data.shared }))
      // CompareView loads its own columns via the ref after mount
      // Store pending compare load to apply once ref is available
      setPendingCompareLoad(data)
    }
  }

  const [panelCollapsed, setPanelCollapsed] = useState(false)
  const [pendingCompareLoad, setPendingCompareLoad] = useState<import('@/lib/presets').ComparePreset | null>(null)

  useEffect(() => {
    if (pendingCompareLoad && compareRef.current) {
      compareRef.current.loadState(pendingCompareLoad)
      setPendingCompareLoad(null)
    }
  }, [pendingCompareLoad, compareMode])

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-emerald-600 rounded flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.347.347A3.001 3.001 0 0112 21a3.001 3.001 0 01-2.12-.879l-.348-.347z" />
            </svg>
          </div>
          <h1 className="text-base font-semibold tracking-tight">LLM API Playground</h1>
        </div>

        <div className="flex items-center gap-3">
          <PresetsPanel onGetCurrentState={getCurrentState} onLoadPreset={loadPreset} />
          <div className="w-px h-5 bg-slate-700" />
          <span className="text-xs text-slate-500">Compare</span>
          <button
            onClick={() => setCompareMode((v) => !v)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              compareMode ? 'bg-emerald-600' : 'bg-slate-700'
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                compareMode ? 'translate-x-[18px]' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </header>

      <main className="p-6">
        {compareMode ? (
          <CompareView
            ref={compareRef}
            initialConfig={config}
            onConfigChange={handleChange}
            onStateChange={handleCompareStateChange}
            initialColumns={initialCompareColumns}
          />
        ) : (
          <div className="flex gap-0">
            {/* Collapsible left panel */}
            <div
              className={`flex-shrink-0 transition-all duration-200 overflow-hidden ${
                panelCollapsed ? 'w-10' : 'w-[380px]'
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
                  <div className="text-xs text-slate-600 mt-2 select-none" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                    Settings
                  </div>
                </div>
              ) : (
                <div className="relative pr-4">
                  <button
                    onClick={() => setPanelCollapsed(true)}
                    className="absolute top-2 right-5 z-10 w-6 h-6 rounded bg-slate-800 hover:bg-slate-700
                      text-slate-500 hover:text-slate-300 transition-colors flex items-center justify-center"
                    title="Collapse settings"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <ConfigPanel
                    config={config}
                    onChange={handleChange}
                    onRun={handleRun}
                    running={loading}
                  />
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="w-px bg-slate-800 flex-shrink-0 mx-4" />

            {/* Output - takes all remaining width */}
            <div className="flex-1 min-w-0 min-h-[600px]">
              <OutputPanel result={result} loading={loading} config={config} />
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
