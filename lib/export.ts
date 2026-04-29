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

function formatCost(n: number): string {
  return n === 0 ? 'Free' : `$${parseFloat(n.toPrecision(4))}`
}

function highlightJson(raw: string): string {
  let pretty = raw
  try { pretty = JSON.stringify(JSON.parse(raw), null, 2) } catch { /* use raw */ }
  return esc(pretty).replace(
    /(&quot;(?:\\.|[^&])*&quot;(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (m) => {
      if (m.startsWith('&quot;')) return /:$/.test(m) ? `<span class="jk">${m}</span>` : `<span class="js">${m}</span>`
      if (m === 'true' || m === 'false') return `<span class="jb">${m}</span>`
      if (m === 'null') return `<span class="jn">${m}</span>`
      return `<span class="jnum">${m}</span>`
    }
  )
}

function settingsHtml(cfg: PrintableConfig, hideModel?: boolean): string {
  function row(label: string, value: string, mono = false) {
    const val = value
      ? mono
        ? `<pre class="cfg-mono">${esc(value)}</pre>`
        : `<span class="cfg-val">${esc(value)}</span>`
      : `<span class="cfg-empty">(none)</span>`
    return `<tr><td class="cfg-lbl">${esc(label)}</td><td>${val}</td></tr>`
  }

  const rows: string[] = []
  rows.push(row('Base URL', cfg.baseUrl))
  if (!hideModel) rows.push(row('Model', cfg.model ?? ''))
  rows.push(row('System Prompt', cfg.systemPrompt))
  rows.push(row('User Prompt', cfg.userPrompt))
  if (cfg.attachments.length > 0) rows.push(row('Attachments', cfg.attachments.map(a => a.name).join(', ')))
  rows.push(row('Temperature', String(cfg.temperature)))
  rows.push(row('Max Tokens', String(cfg.maxTokens)))
  rows.push(row('Top P', String(cfg.topP)))
  rows.push(row('Frequency Penalty', String(cfg.frequencyPenalty)))
  rows.push(row('Presence Penalty', String(cfg.presencePenalty)))
  rows.push(row('Seed', cfg.seed || '-'))
  rows.push(row('Response Format', cfg.responseFormat))
  if (cfg.responseFormat === 'json_schema' && cfg.jsonSchemaText) rows.push(row('JSON Schema', cfg.jsonSchemaText, true))

  return `<table class="cfg-table">${rows.join('')}</table>`
}

function modelCardHtml(model: string, result: CompletionResult | null, idx: number): string {
  const id = `model-${idx}`

  if (!result) {
    return `
      <div class="card">
        <div class="card-header">
          <span class="card-model">${esc(model || '(no model)')}</span>
        </div>
        <div class="no-result">No result</div>
      </div>`
  }

  if (!result.ok) {
    return `
      <div class="card card-error">
        <div class="card-header">
          <span class="card-model">${esc(model || '(no model)')}</span>
          <span class="badge-error">${result.status} ${esc(result.statusText)}</span>
        </div>
        <pre class="code-block error-text">${esc(result.error ?? result.raw)}</pre>
      </div>`
  }

  const usage = getUsage(result)
  const cost = getCost(result)
  const content = getContent(result)

  const stats: string[] = [
    `<div class="stat"><div class="stat-lbl">Latency</div><div class="stat-val">${(result.latencyMs / 1000).toFixed(2)}s</div></div>`,
  ]
  if (usage) {
    if (usage.prompt_tokens != null) stats.push(`<div class="stat"><div class="stat-lbl">Prompt tokens</div><div class="stat-val">${usage.prompt_tokens.toLocaleString()}</div></div>`)
    if (usage.completion_tokens != null) stats.push(`<div class="stat"><div class="stat-lbl">Completion</div><div class="stat-val">${usage.completion_tokens.toLocaleString()}</div></div>`)
    if (usage.total_tokens != null) stats.push(`<div class="stat"><div class="stat-lbl">Total tokens</div><div class="stat-val">${usage.total_tokens.toLocaleString()}</div></div>`)
  }
  if (cost !== null) stats.push(`<div class="stat stat-cost"><div class="stat-lbl">Cost</div><div class="stat-val">${esc(formatCost(cost))}</div></div>`)

  const isJson = content !== null && (content.trim().startsWith('{') || content.trim().startsWith('['))

  const responseBlock = content === null
    ? `<div class="no-result">No content in response</div>`
    : isJson
      ? `<div class="code-wrap">
           <button class="copy-btn" onclick="copyText('${id}')">Copy</button>
           <pre class="code-block" id="${id}">${highlightJson(content)}</pre>
         </div>`
      : `<div class="code-wrap">
           <button class="copy-btn" onclick="copyText('${id}')">Copy</button>
           <pre class="code-block prose-block" id="${id}">${esc(content)}</pre>
         </div>`

  return `
    <div class="card">
      <div class="card-header">
        <span class="card-model">${esc(model || '(no model)')}</span>
        <span class="badge-ok">200 OK</span>
      </div>
      <div class="stats-row">${stats.join('')}</div>
      ${responseBlock}
    </div>`
}

const CSS = `
  :root {
    --bg: #0f172a;
    --surface: #1e293b;
    --border: #334155;
    --border-light: #1e293b;
    --text: #e2e8f0;
    --text-muted: #94a3b8;
    --text-dim: #64748b;
    --green: #10b981;
    --green-dim: #064e3b;
    --green-border: #065f46;
    --red: #f87171;
    --red-bg: #450a0a;
    --red-border: #7f1d1d;
    --code-bg: #020617;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; font-size: 14px; background: var(--bg); color: var(--text); line-height: 1.5; }

  /* Header */
  .top-bar { display: flex; align-items: center; justify-content: space-between; padding: 14px 24px; border-bottom: 1px solid var(--border); background: #0a1628; }
  .top-bar-left { display: flex; align-items: center; gap: 12px; }
  .top-bar img { height: 28px; width: auto; }
  .top-bar .divider { width: 1px; height: 18px; background: var(--border); }
  .top-bar h1 { font-size: 12px; font-weight: 300; letter-spacing: 0.15em; text-transform: uppercase; color: var(--text-muted); }
  .top-bar .meta { font-size: 11px; color: var(--text-dim); }

  /* Layout */
  .page { display: flex; flex-direction: column; gap: 0; }
  .main { padding: 24px; display: flex; flex-direction: column; gap: 24px; }

  /* Settings panel */
  .settings-panel { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
  .settings-toggle { display: flex; align-items: center; justify-content: space-between; padding: 10px 16px; cursor: pointer; user-select: none; }
  .settings-toggle:hover { background: rgba(255,255,255,0.03); }
  .settings-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-dim); }
  .settings-body { padding: 0 16px 16px; border-top: 1px solid var(--border-light); }
  .chevron { font-size: 10px; color: var(--text-dim); transition: transform 0.15s; }
  .chevron.open { transform: rotate(180deg); }

  /* Config table */
  .cfg-table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  .cfg-table tr + tr td { padding-top: 4px; }
  .cfg-lbl { width: 160px; font-size: 11px; font-weight: 600; color: var(--text-dim); padding-right: 16px; vertical-align: top; padding-top: 2px; white-space: nowrap; }
  .cfg-val { font-size: 13px; color: var(--text); white-space: pre-wrap; word-break: break-word; }
  .cfg-empty { font-size: 13px; color: var(--text-dim); font-style: italic; }
  .cfg-mono { font-family: ui-monospace, monospace; font-size: 11px; color: #7dd3fc; background: var(--code-bg); border: 1px solid var(--border); border-radius: 4px; padding: 8px 10px; white-space: pre-wrap; word-break: break-word; margin-top: 2px; }

  /* Model columns */
  .models-grid { display: grid; gap: 16px; }
  .models-grid.cols-1 { grid-template-columns: 1fr; }
  .models-grid.cols-2 { grid-template-columns: 1fr 1fr; }

  /* Card */
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; display: flex; flex-direction: column; }
  .card-error { border-color: var(--red-border); }
  .card-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-bottom: 1px solid var(--border); background: rgba(0,0,0,0.2); flex-shrink: 0; }
  .card-model { font-size: 12px; font-weight: 600; color: var(--text-muted); font-family: ui-monospace, monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .badge-ok { font-size: 10px; font-weight: 700; background: var(--green-dim); color: var(--green); border: 1px solid var(--green-border); border-radius: 4px; padding: 1px 7px; flex-shrink: 0; }
  .badge-error { font-size: 10px; font-weight: 700; background: var(--red-bg); color: var(--red); border: 1px solid var(--red-border); border-radius: 4px; padding: 1px 7px; flex-shrink: 0; }

  /* Stats */
  .stats-row { display: flex; flex-wrap: wrap; gap: 8px; padding: 10px 14px; border-bottom: 1px solid var(--border-light); background: rgba(0,0,0,0.1); }
  .stat { background: var(--bg); border: 1px solid var(--border); border-radius: 4px; padding: 5px 10px; }
  .stat-cost { background: var(--green-dim); border-color: var(--green-border); }
  .stat-lbl { font-size: 10px; color: var(--text-dim); margin-bottom: 1px; }
  .stat-val { font-size: 13px; font-family: ui-monospace, monospace; font-weight: 600; color: var(--text); }
  .stat-cost .stat-lbl { color: #6ee7b7; }
  .stat-cost .stat-val { color: var(--green); }

  /* Code block */
  .code-wrap { position: relative; flex: 1; }
  .copy-btn { position: absolute; top: 10px; right: 10px; font-size: 11px; padding: 4px 10px; background: var(--surface); border: 1px solid var(--border); border-radius: 4px; color: var(--text-muted); cursor: pointer; z-index: 1; transition: background 0.1s, color 0.1s; }
  .copy-btn:hover { background: var(--border); color: var(--text); }
  .copy-btn.copied { color: var(--green); border-color: var(--green-border); }
  .code-block { font-family: ui-monospace, 'Cascadia Code', 'Fira Code', monospace; font-size: 12px; line-height: 1.6; background: var(--code-bg); color: #cbd5e1; padding: 14px; white-space: pre-wrap; word-break: break-word; overflow: auto; }
  .prose-block { font-family: ui-sans-serif, system-ui, sans-serif; font-size: 13px; line-height: 1.7; color: var(--text); background: var(--bg); }
  .error-text { color: var(--red); background: var(--red-bg); }
  .no-result { padding: 16px 14px; font-size: 13px; color: var(--text-dim); font-style: italic; }

  /* JSON syntax */
  .jk   { color: #7dd3fc; }
  .js   { color: #6ee7b7; }
  .jb   { color: #a78bfa; }
  .jn   { color: #64748b; }
  .jnum { color: #fbbf24; }
`

const JS = `
  function copyText(id) {
    const el = document.getElementById(id)
    if (!el) return
    navigator.clipboard.writeText(el.innerText).then(() => {
      const btn = el.closest('.code-wrap').querySelector('.copy-btn')
      if (!btn) return
      btn.textContent = 'Copied!'
      btn.classList.add('copied')
      setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied') }, 1500)
    })
  }

  function toggleSettings(id) {
    const body = document.getElementById(id + '-body')
    const chev = document.getElementById(id + '-chev')
    const open = body.style.display !== 'none'
    body.style.display = open ? 'none' : 'block'
    chev.className = open ? 'chevron' : 'chevron open'
  }
`

export function exportHtml(data: PresetData): void {
  const date = new Date().toLocaleString()

  let settingsSection: string
  let modelsSection: string

  if (data.mode === 'single') {
    settingsSection = `
      <div class="settings-panel">
        <div class="settings-toggle" onclick="toggleSettings('cfg')">
          <span class="settings-title">Settings &mdash; ${esc(data.config.model || '(no model)')}</span>
          <span class="chevron open" id="cfg-chev">&#9660;</span>
        </div>
        <div class="settings-body" id="cfg-body">${settingsHtml(data.config)}</div>
      </div>`

    modelsSection = `
      <div class="models-grid cols-1">
        ${modelCardHtml(data.config.model, data.result, 0)}
      </div>`
  } else {
    settingsSection = `
      <div class="settings-panel">
        <div class="settings-toggle" onclick="toggleSettings('cfg')">
          <span class="settings-title">Shared Settings</span>
          <span class="chevron open" id="cfg-chev">&#9660;</span>
        </div>
        <div class="settings-body" id="cfg-body">${settingsHtml(data.shared, true)}</div>
      </div>`

    const cols = data.columns.length === 1 ? 'cols-1' : 'cols-2'
    modelsSection = `
      <div class="models-grid ${cols}">
        ${data.columns.map((col, i) => modelCardHtml(col.model, col.result, i)).join('')}
      </div>`
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Model Compare Export</title>
<style>${CSS}</style>
</head>
<body>
  <div class="page">
    <div class="top-bar">
      <div class="top-bar-left">
        <img src="https://www.prosperahq.io/images/prospera_whitebg_color_horizontal-transparent-1.svg" alt="Prospera" />
        <div class="divider"></div>
        <h1>Model Compare</h1>
      </div>
      <span class="meta">${esc(date)}</span>
    </div>
    <div class="main">
      ${modelsSection}
      ${settingsSection}
    </div>
  </div>
  <script>${JS}</script>
</body>
</html>`

  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `model-compare-${Date.now()}.html`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
