'use client'

import type { RequestConfig, ResponseFormat } from '@/lib/api'
import Slider from './Slider'
import ModelSearch from './ModelSearch'
import ExpandableTextarea from './ExpandableTextarea'
import FileAttachments from './FileAttachments'

interface ConfigPanelProps {
  config: RequestConfig
  onChange: (patch: Partial<RequestConfig>) => void
  onRun: () => void
  running: boolean
  hideSharedPrompts?: boolean
  hideResponseFormat?: boolean
  hideModel?: boolean
  runLabel?: string
}

export default function ConfigPanel({
  config,
  onChange,
  onRun,
  running,
  hideSharedPrompts,
  hideResponseFormat,
  hideModel,
  runLabel,
}: ConfigPanelProps) {
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      onRun()
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4 bg-slate-900 rounded-lg border border-slate-700">
      {/* Run Button */}
      <button
        onClick={onRun}
        disabled={running}
        className="w-full py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700
          disabled:text-slate-500 text-white text-sm font-semibold rounded transition-colors flex items-center
          justify-center gap-1.5"
      >
        {running ? (
          <>
            <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Running...
          </>
        ) : (
          runLabel ?? 'Run'
        )}
      </button>

      {/* API Connection */}
      <div className="flex flex-col gap-3">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Connection</h3>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-400">API Key</label>
          <input
            type="password"
            value={config.apiKey}
            onChange={(e) => onChange({ apiKey: e.target.value })}
            placeholder="sk-..."
            className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-slate-200
              placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-400">Base URL</label>
          <input
            type="text"
            value={config.baseUrl}
            onChange={(e) => onChange({ baseUrl: e.target.value })}
            className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-slate-200
              placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        {!hideModel && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-400">Model</label>
            <ModelSearch
              value={config.model}
              onChange={(v) => onChange({ model: v })}
            />
          </div>
        )}
      </div>

      {/* Prompts */}
      {!hideSharedPrompts && (
        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Prompts</h3>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-400">System Prompt</label>
            <ExpandableTextarea
              label="System Prompt"
              value={config.systemPrompt}
              onChange={(v) => onChange({ systemPrompt: v })}
              onKeyDown={handleKeyDown}
              rows={2}
              placeholder="Optional system instructions..."
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-400">
              User Prompt
              <span className="ml-2 text-slate-600 font-normal">Cmd+Enter to run</span>
            </label>
            <ExpandableTextarea
              label="User Prompt"
              value={config.userPrompt}
              onChange={(v) => onChange({ userPrompt: v })}
              onKeyDown={handleKeyDown}
              rows={3}
              placeholder="Enter your message..."
            />
          </div>

          <FileAttachments
            attachments={config.attachments}
            onChange={(attachments) => onChange({ attachments })}
          />
        </div>
      )}

      {/* Parameters */}
      <div className="flex flex-col gap-3">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Parameters</h3>

        <Slider label="Temperature" value={config.temperature} onChange={(v) => onChange({ temperature: v })} min={0} max={2} step={0.01} />
        <Slider label="Max Tokens" value={config.maxTokens} onChange={(v) => onChange({ maxTokens: v })} min={1} max={16384} step={1} />
        <Slider label="Top P" value={config.topP} onChange={(v) => onChange({ topP: v })} min={0} max={1} step={0.01} />
        <Slider label="Frequency Penalty" value={config.frequencyPenalty} onChange={(v) => onChange({ frequencyPenalty: v })} min={-2} max={2} step={0.01} />
        <Slider label="Presence Penalty" value={config.presencePenalty} onChange={(v) => onChange({ presencePenalty: v })} min={-2} max={2} step={0.01} />

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-400">Seed</label>
          <input
            type="text"
            value={config.seed}
            onChange={(e) => onChange({ seed: e.target.value })}
            placeholder="Optional integer"
            className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-slate-200
              placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>
      </div>

      {/* Response Format */}
      {!hideResponseFormat && (
        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Response Format</h3>

          <select
            value={config.responseFormat}
            onChange={(e) => onChange({ responseFormat: e.target.value as ResponseFormat })}
            className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-slate-200
              focus:outline-none focus:border-emerald-500 transition-colors"
          >
            <option value="text">Text</option>
            <option value="json_object">JSON Object</option>
            <option value="json_schema">JSON Schema</option>
          </select>

          {config.responseFormat === 'json_schema' && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-400">JSON Schema</label>
              <ExpandableTextarea
                label="JSON Schema"
                value={config.jsonSchemaText}
                onChange={(v) => onChange({ jsonSchemaText: v })}
                rows={3}
                placeholder='{"name": "...", "schema": {...}}'
                mono
              />
            </div>
          )}
        </div>
      )}

    </div>
  )
}
