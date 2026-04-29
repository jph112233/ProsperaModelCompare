import type { CompletionResult } from './api'

export interface CompareColumn {
  model: string
  result: CompletionResult | null
}

// Strip markdown code fences (```json ... ```) that models sometimes wrap JSON in
function stripFences(s: string): string {
  const m = s.match(/^```(?:json)?\s*([\s\S]+?)\s*```$/)
  return m ? m[1] : s
}

function getContent(result: CompletionResult): string | null {
  if (!result.parsed) return null
  const choices = (result.parsed as Record<string, unknown>).choices as Array<Record<string, unknown>> | undefined
  if (!choices?.[0]) return null
  const msg = choices[0].message as Record<string, unknown> | undefined
  return typeof msg?.content === 'string' ? msg.content : null
}

function tryParseJson(s: string): unknown | null {
  try { return JSON.parse(stripFences(s.trim())) } catch { return null }
}

// Flatten a JSON value into dot-notation key → primitive value pairs
function flatten(obj: unknown, prefix = ''): Array<[string, unknown]> {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return prefix ? [[prefix, obj]] : []
  }
  if (Array.isArray(obj)) {
    if (obj.length === 0) return prefix ? [[prefix, '[ ]']] : []
    return obj.flatMap((item, i) => flatten(item, prefix ? `${prefix}[${i}]` : `[${i}]`))
  }
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === 'object') return flatten(v, key)
    return [[key, v]]
  })
}

function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderValue(v: unknown): string {
  if (v === null) return '<span class="vnull">null</span>'
  if (v === undefined) return '<span class="vmissing">—</span>'
  if (typeof v === 'boolean') return `<span class="vbool">${v}</span>`
  if (typeof v === 'number') return `<span class="vnum">${v}</span>`
  return `<span class="vstr">${esc(String(v))}</span>`
}

function allEqual(vals: unknown[]): boolean {
  const defined = vals.filter(v => v !== undefined)
  if (defined.length < 2) return true
  const first = JSON.stringify(defined[0])
  return defined.every(v => JSON.stringify(v) === first)
}

function buildJsonComparisonTable(parsed: unknown[], models: string[]): string {
  // Build union of all keys in order (depth-first from first model)
  const keySet = new Set<string>()
  const keyMaps = parsed.map(p => new Map(flatten(p)))
  keyMaps.forEach(m => m.forEach((_, k) => keySet.add(k)))
  const allKeys = Array.from(keySet)

  const rows = allKeys.map(key => {
    const vals = keyMaps.map(m => m.get(key))
    const match = allEqual(vals)
    const rowClass = match ? 'row-match' : vals.some(v => v === undefined) ? 'row-missing' : 'row-diff'
    const cells = vals.map(v =>
      v === undefined
        ? `<td class="cell cell-missing"><span class="vmissing">—</span></td>`
        : `<td class="cell">${renderValue(v)}</td>`
    ).join('')
    const indicator = match
      ? `<td class="cell-indicator match-icon" title="Match">&#10003;</td>`
      : `<td class="cell-indicator diff-icon" title="Differs">&#9650;</td>`
    return `<tr class="${rowClass}"><td class="key-cell">${esc(key)}</td>${cells}${indicator}</tr>`
  }).join('')

  const headerCells = models.map(m => `<th class="col-header">${esc(m || '(no model)')}</th>`).join('')
  const matchCount = allKeys.filter(k => allEqual(keyMaps.map(m => m.get(k)))).length
  const diffCount = allKeys.filter(k => !allEqual(keyMaps.map(m => m.get(k)))).length

  return `
    <div class="summary">
      ${allKeys.length} fields &nbsp;&middot;&nbsp;
      <span class="sum-match">${matchCount} match</span>
      &nbsp;&middot;&nbsp;
      <span class="sum-diff">${diffCount} differ</span>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th class="key-header">Field</th>
            ${headerCells}
            <th class="col-indicator"></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`
}

function buildTextComparisonGrid(contents: (string | null)[], models: string[]): string {
  const cols = contents.map((c, i) => `
    <div class="text-col">
      <div class="text-col-header">${esc(models[i] || `Model ${i + 1}`)}</div>
      <pre class="text-body">${c ? esc(c) : '<span class="vmissing">(no content)</span>'}</pre>
    </div>`).join('')
  return `<div class="text-grid">${cols}</div>`
}

export function openCompareWindow(columns: CompareColumn[]): void {
  const models = columns.map(c => c.model)
  const results = columns.map(c => c.result)
  const contents = results.map(r => (r?.ok ? getContent(r) : null))
  const parsed = contents.map(c => (c ? tryParseJson(c) : null))
  const allJson = parsed.every(p => p !== null)

  const date = new Date().toLocaleString()
  const body = allJson
    ? buildJsonComparisonTable(parsed as unknown[], models)
    : buildTextComparisonGrid(contents, models)

  const modeLabel = allJson ? 'JSON field comparison' : 'Text comparison'

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Model Compare - Results</title>
<style>
  :root {
    --bg: #0f172a; --surface: #1e293b; --surface2: #162032;
    --border: #334155; --text: #e2e8f0; --muted: #94a3b8; --dim: #64748b;
    --green: #10b981; --green-bg: #052e16; --green-border: #065f46;
    --amber: #f59e0b; --amber-bg: #1c1000; --amber-border: #78350f;
    --red: #f87171; --red-bg: #1c0a0a;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; font-size: 13px; background: var(--bg); color: var(--text); line-height: 1.5; }

  /* Top bar */
  .top-bar { display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; border-bottom: 1px solid var(--border); background: #0a1628; position: sticky; top: 0; z-index: 10; }
  .top-bar-left { display: flex; align-items: center; gap: 10px; }
  .top-bar img { height: 24px; width: auto; }
  .top-divider { width: 1px; height: 16px; background: var(--border); }
  .top-title { font-size: 11px; font-weight: 300; letter-spacing: 0.15em; text-transform: uppercase; color: var(--muted); }
  .top-meta { font-size: 11px; color: var(--dim); }

  /* Summary bar */
  .summary { display: flex; align-items: center; gap: 12px; padding: 10px 20px; font-size: 12px; color: var(--dim); border-bottom: 1px solid var(--border); background: var(--surface2); }
  .sum-match { color: var(--green); font-weight: 600; }
  .sum-diff  { color: var(--amber); font-weight: 600; }
  .mode-label { margin-left: auto; font-size: 10px; text-transform: uppercase; letter-spacing: 0.07em; color: var(--dim); }

  /* Table */
  .table-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  thead th { position: sticky; top: 49px; background: var(--surface); padding: 8px 12px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--dim); border-bottom: 2px solid var(--border); text-align: left; }
  .key-header { width: 260px; min-width: 180px; }
  .col-header { min-width: 220px; }
  .col-indicator { width: 32px; }

  tbody tr { border-bottom: 1px solid #1a2740; }
  tbody tr:hover { background: rgba(255,255,255,0.02); }
  .row-match  { background: transparent; }
  .row-diff   { background: rgba(245,158,11,0.04); }
  .row-missing { background: rgba(100,116,139,0.04); }

  .key-cell { padding: 7px 12px; font-family: ui-monospace, monospace; font-size: 11px; color: var(--muted); vertical-align: top; word-break: break-all; }
  .cell { padding: 7px 12px; vertical-align: top; word-break: break-word; max-width: 320px; }
  .cell-missing { background: rgba(100,116,139,0.06); }
  .cell-indicator { padding: 7px 8px; text-align: center; vertical-align: top; font-size: 13px; }
  .match-icon { color: var(--green); }
  .diff-icon  { color: var(--amber); font-size: 10px; }

  /* Value types */
  .vstr  { color: #6ee7b7; }
  .vnum  { color: #fbbf24; font-family: ui-monospace, monospace; }
  .vbool { color: #a78bfa; font-family: ui-monospace, monospace; }
  .vnull { color: var(--dim); font-style: italic; }
  .vmissing { color: var(--dim); }

  /* Text comparison */
  .text-grid { display: grid; grid-template-columns: repeat(${columns.length}, 1fr); gap: 1px; background: var(--border); height: calc(100vh - 50px); }
  .text-col { display: flex; flex-direction: column; background: var(--bg); overflow: hidden; }
  .text-col-header { padding: 10px 14px; font-size: 11px; font-weight: 600; color: var(--muted); font-family: ui-monospace, monospace; border-bottom: 1px solid var(--border); background: var(--surface); flex-shrink: 0; }
  .text-body { flex: 1; overflow: auto; padding: 14px; font-size: 12px; font-family: ui-monospace, monospace; white-space: pre-wrap; word-break: break-word; color: #cbd5e1; line-height: 1.6; }
</style>
</head>
<body>
  <div class="top-bar">
    <div class="top-bar-left">
      <img src="https://www.prosperahq.io/images/prospera_whitebg_color_horizontal-transparent.svg" alt="Prospera" />
      <div class="top-divider"></div>
      <span class="top-title">Results Comparison</span>
    </div>
    <span class="top-meta">${esc(date)}</span>
  </div>
  ${body}
</body>
</html>`

  const win = window.open('', '_blank', 'width=1200,height=800')
  if (!win) return
  win.document.write(html)
  win.document.close()
}
