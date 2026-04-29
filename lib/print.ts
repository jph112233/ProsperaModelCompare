import type { PresetData } from './presets'
import type { RequestConfig, CompletionResult } from './api'

type PrintableConfig = Omit<RequestConfig, 'model'> & { model?: string }

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function row(label: string, value: string, mono = false): string {
  const cell = mono
    ? `<td class="val"><pre class="mono">${esc(value)}</pre></td>`
    : `<td class="val">${esc(value) || '<em>(none)</em>'}</td>`
  return `<tr><td class="lbl">${esc(label)}</td>${cell}</tr>`
}

function configRows(cfg: PrintableConfig, hideModel?: boolean): string {
  const rows: string[] = []
  rows.push(row('Base URL', cfg.baseUrl))
  if (!hideModel) rows.push(row('Model', cfg.model ?? ''))
  rows.push(row('System Prompt', cfg.systemPrompt))
  rows.push(row('User Prompt', cfg.userPrompt))
  if (cfg.attachments.length > 0) {
    rows.push(row('Attachments', cfg.attachments.map((a) => a.name).join(', ')))
  }
  rows.push(row('Temperature', String(cfg.temperature)))
  rows.push(row('Max Tokens', String(cfg.maxTokens)))
  rows.push(row('Top P', String(cfg.topP)))
  rows.push(row('Frequency Penalty', String(cfg.frequencyPenalty)))
  rows.push(row('Presence Penalty', String(cfg.presencePenalty)))
  rows.push(row('Seed', cfg.seed || '-'))
  rows.push(row('Response Format', cfg.responseFormat))
  if (cfg.responseFormat === 'json_schema' && cfg.jsonSchemaText) {
    rows.push(row('JSON Schema', cfg.jsonSchemaText, true))
  }
  return rows.join('\n')
}

function getContent(result: CompletionResult): string | null {
  if (!result.parsed) return null
  const choices = (result.parsed as Record<string, unknown>).choices as Array<Record<string, unknown>> | undefined
  if (!choices?.[0]) return null
  const msg = choices[0].message as Record<string, unknown> | undefined
  return typeof msg?.content === 'string' ? msg.content : null
}

function getUsage(result: CompletionResult): Record<string, number> | null {
  if (!result.parsed) return null
  return ((result.parsed as Record<string, unknown>).usage as Record<string, number> | undefined) ?? null
}

function getCost(result: CompletionResult): number | null {
  if (!result.parsed) return null
  const r = result.parsed as Record<string, unknown>
  const usageCost = (r.usage as Record<string, unknown> | undefined)?.cost
  if (typeof usageCost === 'number') return usageCost
  if (typeof r.cost === 'number') return r.cost
  return null
}

function formatCost(dollars: number): string {
  if (dollars === 0) return 'Free'
  return `$${parseFloat(dollars.toPrecision(4))}`
}

function resultHtml(result: CompletionResult | null): string {
  if (!result) {
    return `<div class="no-result">No result</div>`
  }

  if (!result.ok) {
    return `
      <div class="error-badge">${result.status} ${esc(result.statusText)}</div>
      <pre class="error-body">${esc(result.error ?? result.raw)}</pre>
    `
  }

  const usage = getUsage(result)
  const cost = getCost(result)
  const content = getContent(result)

  const stats: string[] = [
    `<div class="stat"><span class="stat-lbl">Latency</span><span class="stat-val">${(result.latencyMs / 1000).toFixed(2)}s</span></div>`,
  ]
  if (usage) {
    if (usage.prompt_tokens != null) stats.push(`<div class="stat"><span class="stat-lbl">Prompt tokens</span><span class="stat-val">${usage.prompt_tokens}</span></div>`)
    if (usage.completion_tokens != null) stats.push(`<div class="stat"><span class="stat-lbl">Completion tokens</span><span class="stat-val">${usage.completion_tokens}</span></div>`)
    if (usage.total_tokens != null) stats.push(`<div class="stat"><span class="stat-lbl">Total tokens</span><span class="stat-val">${usage.total_tokens}</span></div>`)
  }
  if (cost !== null) stats.push(`<div class="stat stat-cost"><span class="stat-lbl">Cost</span><span class="stat-val">${esc(formatCost(cost))}</span></div>`)

  const isJson = content !== null && (content.trim().startsWith('{') || content.trim().startsWith('['))
  const contentHtml = content === null
    ? `<div class="no-result">No content in response</div>`
    : isJson
      ? `<pre class="mono response-body">${esc(content)}</pre>`
      : `<pre class="response-body">${esc(content)}</pre>`

  return `
    <div class="stats-row">${stats.join('')}</div>
    ${contentHtml}
  `
}

function modelGridHtml(columns: Array<{ model: string; result: CompletionResult | null }>): string {
  // Pair columns into rows of 2 using a table — tables print reliably unlike CSS grid
  const tds = columns.map((col, i) => `
    <td class="model-col" valign="top">
      <div class="model-col-header">Model ${i + 1} &mdash; ${esc(col.model || '(none)')}</div>
      ${resultHtml(col.result)}
    </td>
  `)

  const tableRows: string[] = []
  for (let i = 0; i < tds.length; i += 2) {
    const pair = tds.slice(i, i + 2)
    // Pad odd last row with an empty cell
    if (pair.length === 1) pair.push('<td class="model-col" valign="top"></td>')
    tableRows.push(`<tr>${pair.join('')}</tr>`)
  }

  return `<table class="model-table"><tbody>${tableRows.join('')}</tbody></table>`
}

export function openPrintWindow(data: PresetData): void {
  const date = new Date().toLocaleString()

  let body: string
  if (data.mode === 'single') {
    body = `
      <div class="section-header">Response &mdash; ${esc(data.config.model || '(no model)')}</div>
      ${resultHtml(data.result)}
      <div class="section-header">Settings</div>
      <table class="settings-table"><tbody>${configRows(data.config)}</tbody></table>
    `
  } else {
    body = `
      ${modelGridHtml(data.columns)}
      <div class="section-header">Shared Settings</div>
      <table class="settings-table"><tbody>${configRows(data.shared, true)}</tbody></table>
    `
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Model Compare - Print</title>
<style>
  @page { size: letter portrait; margin: 0.5in; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
    font-size: 12px;
    color: #1e293b;
    background: #fff;
    padding: 0.5in;
  }
  @media print { body { padding: 0; } }

  /* Header */
  .header { display: flex; align-items: center; gap: 10px; margin-bottom: 3px; }
  .header img { height: 26px; width: auto; }
  .header .divider { width: 1px; height: 16px; background: #cbd5e1; }
  .header h1 { font-size: 12px; font-weight: 300; letter-spacing: 0.15em; text-transform: uppercase; color: #475569; }
  .date { font-size: 10px; color: #94a3b8; margin-bottom: 16px; }

  /* Section headers */
  .section-header {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #64748b;
    margin: 16px 0 6px;
    padding-bottom: 3px;
    border-bottom: 1px solid #e2e8f0;
  }

  /* Settings table */
  .settings-table { width: 100%; border-collapse: collapse; }
  .settings-table td { padding: 3px 0; vertical-align: top; }
  .lbl {
    width: 150px;
    padding-right: 12px;
    font-size: 10px;
    font-weight: 600;
    color: #64748b;
    white-space: nowrap;
  }
  .val { color: #1e293b; word-break: break-word; white-space: pre-wrap; line-height: 1.4; font-size: 11px; }

  /* Model grid table */
  .model-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .model-col { width: 50%; vertical-align: top; padding-right: 10px; }
  .model-col + .model-col { padding-right: 0; padding-left: 10px; }
  .model-col-header {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #64748b;
    margin: 0 0 6px;
    padding-bottom: 3px;
    border-bottom: 1px solid #e2e8f0;
  }

  /* Stats row */
  .stats-row { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 8px; }
  .stat {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 3px;
    padding: 3px 7px;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .stat-cost { background: #f0fdf4; border-color: #bbf7d0; }
  .stat-lbl { font-size: 9px; color: #94a3b8; }
  .stat-val { font-size: 11px; font-family: ui-monospace, monospace; color: #1e293b; font-weight: 600; }
  .stat-cost .stat-lbl { color: #16a34a; }
  .stat-cost .stat-val { color: #15803d; }

  /* Response / mono blocks */
  .response-body {
    font-size: 11px;
    line-height: 1.5;
    color: #1e293b;
    white-space: pre-wrap;
    word-break: break-word;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 3px;
    padding: 8px 10px;
  }
  .mono {
    font-family: ui-monospace, 'Cascadia Code', monospace;
    font-size: 10px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 3px;
    padding: 6px 8px;
    white-space: pre-wrap;
    word-break: break-word;
  }

  /* Errors */
  .error-badge {
    display: inline-block;
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #991b1b;
    font-size: 10px;
    font-weight: 600;
    border-radius: 3px;
    padding: 2px 6px;
    margin-bottom: 6px;
  }
  .error-body {
    font-family: ui-monospace, monospace;
    font-size: 10px;
    color: #991b1b;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 3px;
    padding: 8px 10px;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .no-result { font-size: 11px; color: #94a3b8; font-style: italic; }
</style>
</head>
<body>
  <div class="header">
    <img src="https://www.prosperahq.io/images/prospera_whitebg_color_horizontal-transparent.svg" alt="Prospera" />
    <div class="divider"></div>
    <h1>Model Compare</h1>
  </div>
  <div class="date">${esc(date)}</div>
  ${body}
  <script>window.onload = () => window.print()</script>
</body>
</html>`

  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
}
