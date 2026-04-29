'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { CompletionResult, RequestConfig } from '@/lib/api'
import { buildCurl, buildPayload } from '@/lib/api'

interface OutputPanelProps {
  result: CompletionResult | null
  loading: boolean
  config: RequestConfig
}

type Tab = 'response' | 'raw' | 'curl'

// ── JSON syntax highlighter ──────────────────────────────────────────────────

function jsonToHtml(json: string): string {
  return json.replace(
    /("(?:\\.|[^"\\])*"(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      if (/^"/.test(match)) {
        return /:$/.test(match)
          ? `<span class="json-key">${match}</span>`
          : `<span class="json-str">${match}</span>`
      }
      if (match === 'true' || match === 'false') return `<span class="json-bool">${match}</span>`
      if (match === 'null') return `<span class="json-null">${match}</span>`
      return `<span class="json-num">${match}</span>`
    }
  )
}

function JsonView({ content }: { content: string }) {
  let pretty = content
  try { pretty = JSON.stringify(JSON.parse(content), null, 2) } catch { /* use raw */ }
  return (
    <pre
      className="text-sm font-mono leading-relaxed whitespace-pre-wrap break-words json-block"
      dangerouslySetInnerHTML={{ __html: jsonToHtml(pretty) }}
    />
  )
}

// ── Markdown renderer ────────────────────────────────────────────────────────

function MarkdownView({ content }: { content: string }) {
  return (
    <div className="prose-output">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="text-2xl font-bold text-slate-100 mt-6 mb-3 pb-2 border-b border-slate-700">{children}</h1>,
          h2: ({ children }) => <h2 className="text-xl font-bold text-slate-100 mt-5 mb-2 pb-1 border-b border-slate-800">{children}</h2>,
          h3: ({ children }) => <h3 className="text-lg font-semibold text-slate-200 mt-4 mb-2">{children}</h3>,
          h4: ({ children }) => <h4 className="text-base font-semibold text-slate-300 mt-3 mb-1">{children}</h4>,
          p: ({ children }) => <p className="text-slate-300 leading-relaxed mb-3">{children}</p>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer"
              className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2 transition-colors">
              {children}
            </a>
          ),
          strong: ({ children }) => <strong className="font-semibold text-slate-100">{children}</strong>,
          em: ({ children }) => <em className="italic text-slate-300">{children}</em>,
          ul: ({ children }) => <ul className="list-disc list-outside ml-5 mb-3 space-y-1 text-slate-300">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-outside ml-5 mb-3 space-y-1 text-slate-300">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-emerald-700 pl-4 my-3 text-slate-400 italic">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="border-slate-700 my-5" />,
          code: ({ className, children, ...props }) => {
            const isBlock = className?.startsWith('language-')
            const lang = className?.replace('language-', '') ?? ''
            if (isBlock) {
              return (
                <div className="my-3 rounded-lg overflow-hidden border border-slate-700">
                  {lang && (
                    <div className="px-4 py-1.5 bg-slate-800 text-xs text-slate-500 font-mono border-b border-slate-700">
                      {lang}
                    </div>
                  )}
                  <pre className="bg-slate-950 px-4 py-3 overflow-x-auto">
                    <code className="text-sm font-mono text-slate-200 leading-relaxed">
                      {children}
                    </code>
                  </pre>
                </div>
              )
            }
            return (
              <code
                className="bg-slate-800 text-emerald-300 text-xs font-mono px-1.5 py-0.5 rounded"
                {...props}
              >
                {children}
              </code>
            )
          },
          pre: ({ children }) => <>{children}</>,
          table: ({ children }) => (
            <div className="overflow-x-auto my-4">
              <table className="w-full text-sm border-collapse border border-slate-700">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-slate-800">{children}</thead>,
          tbody: ({ children }) => <tbody className="divide-y divide-slate-800">{children}</tbody>,
          tr: ({ children }) => <tr className="hover:bg-slate-800/50 transition-colors">{children}</tr>,
          th: ({ children }) => (
            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-700">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 text-slate-300 border-r border-slate-800 last:border-r-0">
              {children}
            </td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCost(dollars: number): string {
  if (dollars === 0) return 'Free'
  // 4 significant figures, trailing zeros stripped
  return `$${parseFloat(dollars.toPrecision(4))}`
}

function isJson(s: string): boolean {
  const t = s.trim()
  if (!t.startsWith('{') && !t.startsWith('[')) return false
  try { JSON.parse(t); return true } catch { return false }
}

function CopyButton({ getText }: { getText: () => string }) {
  const [copied, setCopied] = useState(false)
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(getText())
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* unavailable */ }
  }
  return (
    <button
      onClick={handleCopy}
      className="text-xs px-2.5 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300
        transition-colors flex items-center gap-1.5"
    >
      {copied ? (
        <>
          <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Copied
        </>
      ) : (
        <>
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copy
        </>
      )}
    </button>
  )
}

function StatCard({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className={`rounded px-3 py-2 flex flex-col gap-0.5 ${highlight ? 'bg-emerald-950 border border-emerald-800' : 'bg-slate-800'}`}>
      <span className={`text-xs ${highlight ? 'text-emerald-500' : 'text-slate-500'}`}>{label}</span>
      <span className={`text-sm font-mono ${highlight ? 'text-emerald-300' : 'text-slate-200'}`}>{value}</span>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export default function OutputPanel({ result, loading, config }: OutputPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('response')

  const payload = buildPayload(config)
  const curlText = buildCurl(config, payload)

  function getUsage() {
    if (!result?.parsed) return null
    const u = (result.parsed as Record<string, unknown>).usage as Record<string, number> | undefined
    return u ?? null
  }

  function getCost(): number | null {
    if (!result?.parsed) return null
    const r = result.parsed as Record<string, unknown>
    // OpenRouter: usage.cost
    const usageCost = (r.usage as Record<string, unknown> | undefined)?.cost
    if (typeof usageCost === 'number') return usageCost
    // fallback: top-level cost field
    if (typeof r.cost === 'number') return r.cost
    return null
  }

  function getContent(): string | null {
    if (!result?.parsed) return null
    const choices = (result.parsed as Record<string, unknown>).choices as Array<Record<string, unknown>> | undefined
    if (!choices?.[0]) return null
    const msg = choices[0].message as Record<string, unknown> | undefined
    return typeof msg?.content === 'string' ? msg.content : null
  }

  function renderContent() {
    const content = getContent()
    if (content === null) return null

    const forceJson = config.responseFormat !== 'text'

    if (forceJson || isJson(content)) {
      return <JsonView content={content} />
    }
    return <MarkdownView content={content} />
  }

  function getTabText(): string {
    if (activeTab === 'curl') return curlText
    if (activeTab === 'raw') return result?.raw ?? ''
    const content = getContent()
    if (content !== null) return content
    if (result?.error) return result.error
    return ''
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'response', label: 'Response' },
    { id: 'raw', label: 'Raw JSON' },
    { id: 'curl', label: 'cURL' },
  ]

  return (
    <>
      {/* Inject JSON highlight colours once */}
      <style>{`
        .json-key  { color: #7dd3fc; }
        .json-str  { color: #6ee7b7; }
        .json-num  { color: #fbbf24; }
        .json-bool { color: #a78bfa; }
        .json-null { color: #64748b; }
      `}</style>

      <div className="flex flex-col h-full bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
        {/* Tab bar */}
        <div className="flex items-center justify-between border-b border-slate-700 px-2 pt-2 flex-shrink-0">
          <div className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-t transition-colors ${
                  activeTab === tab.id
                    ? 'bg-slate-800 text-emerald-400 border-b-2 border-emerald-500'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="pb-2">
            <CopyButton getText={getTabText} />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {loading && (
            <div className="flex items-center justify-center h-32 text-slate-500 gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Waiting for response...
            </div>
          )}

          {!loading && activeTab === 'response' && (
            <div className="flex flex-col gap-4">
              {result && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                  <StatCard label="Latency" value={`${(result.latencyMs / 1000).toFixed(2)}s`} />
                  {getUsage() && (
                    <>
                      <StatCard label="Prompt Tokens" value={getUsage()!.prompt_tokens ?? '-'} />
                      <StatCard label="Completion" value={getUsage()!.completion_tokens ?? '-'} />
                      <StatCard label="Total Tokens" value={getUsage()!.total_tokens ?? '-'} />
                    </>
                  )}
                  {getCost() !== null && (
                    <StatCard label="Cost" value={formatCost(getCost()!)} highlight />
                  )}
                </div>
              )}

              {result?.ok && renderContent()}

              {result && !result.ok && (
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-mono bg-red-900 text-red-300 px-2 py-0.5 rounded w-fit">
                    {result.status} {result.statusText}
                  </span>
                  <pre className="text-sm font-mono text-red-300 whitespace-pre-wrap break-words bg-slate-800 rounded p-3">
                    {result.error}
                  </pre>
                </div>
              )}

              {!result && !loading && (
                <p className="text-slate-600 text-sm">Run a request to see the response here.</p>
              )}
            </div>
          )}

          {!loading && activeTab === 'raw' && (
            <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap break-words">
              {result?.raw ?? 'No response yet.'}
            </pre>
          )}

          {!loading && activeTab === 'curl' && (
            <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap break-words">
              {curlText}
            </pre>
          )}
        </div>
      </div>
    </>
  )
}
