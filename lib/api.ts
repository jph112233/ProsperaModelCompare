export type ResponseFormat = 'text' | 'json_object' | 'json_schema'

export interface Attachment {
  id: string
  name: string
  kind: 'image' | 'text'
  mimeType: string
  dataUrl: string   // full data URL for images; "data:text/plain;base64,..." for text
  text?: string     // decoded text content for text files
  size: number      // bytes
}

export interface RequestConfig {
  apiKey: string
  baseUrl: string
  model: string
  systemPrompt: string
  userPrompt: string
  temperature: number
  maxTokens: number
  topP: number
  frequencyPenalty: number
  presencePenalty: number
  seed: string
  responseFormat: ResponseFormat
  jsonSchemaText: string
  attachments: Attachment[]
}

export interface CompletionResult {
  ok: boolean
  status: number
  statusText: string
  latencyMs: number
  payload: object
  raw: string
  parsed?: Record<string, unknown>
  error?: string
}

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

export function buildPayload(cfg: RequestConfig): object {
  const messages: { role: string; content: string | ContentPart[] }[] = []

  if (cfg.systemPrompt.trim()) {
    messages.push({ role: 'system', content: cfg.systemPrompt })
  }

  if (cfg.attachments.length === 0) {
    messages.push({ role: 'user', content: cfg.userPrompt })
  } else {
    const parts: ContentPart[] = []

    if (cfg.userPrompt.trim()) {
      parts.push({ type: 'text', text: cfg.userPrompt })
    }

    for (const att of cfg.attachments) {
      if (att.kind === 'image') {
        parts.push({ type: 'image_url', image_url: { url: att.dataUrl } })
      } else {
        parts.push({
          type: 'text',
          text: `\n\n--- ${att.name} ---\n${att.text ?? ''}`,
        })
      }
    }

    messages.push({ role: 'user', content: parts })
  }

  const body: Record<string, unknown> = {
    model: cfg.model,
    messages,
    temperature: cfg.temperature,
    max_tokens: cfg.maxTokens,
    top_p: cfg.topP,
    frequency_penalty: cfg.frequencyPenalty,
    presence_penalty: cfg.presencePenalty,
  }

  const seedNum = parseInt(cfg.seed, 10)
  if (!isNaN(seedNum)) {
    body.seed = seedNum
  }

  if (cfg.responseFormat === 'json_object') {
    body.response_format = { type: 'json_object' }
  } else if (cfg.responseFormat === 'json_schema') {
    try {
      const parsed = JSON.parse(cfg.jsonSchemaText)
      body.response_format = { type: 'json_schema', json_schema: parsed }
    } catch {
      // malformed schema - skip response_format
    }
  }

  return body
}

export function buildCurl(cfg: RequestConfig, payload: object): string {
  const maskedKey = cfg.apiKey
    ? `sk-...${cfg.apiKey.slice(-4)}`
    : ''

  const headerLines: string[] = [
    `  -H 'Content-Type: application/json'`,
  ]
  if (maskedKey) {
    headerLines.push(`  -H 'Authorization: Bearer ${maskedKey}'`)
  }

  const url = `${cfg.baseUrl.replace(/\/$/, '')}/chat/completions`
  const bodyStr = JSON.stringify(payload, null, 2)
    .split('\n')
    .join('\n  ')

  return `curl -X POST '${url}' \\
${headerLines.join(' \\\n')} \\
  -d '${bodyStr}'`
}

export async function runCompletion(cfg: RequestConfig): Promise<CompletionResult> {
  const payload = buildPayload(cfg)
  const url = `${cfg.baseUrl.replace(/\/$/, '')}/chat/completions`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (cfg.apiKey) {
    headers['Authorization'] = `Bearer ${cfg.apiKey}`
  }

  const start = performance.now()
  let response: Response

  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })
  } catch (err) {
    const latencyMs = performance.now() - start
    return {
      ok: false,
      status: 0,
      statusText: 'Network Error',
      latencyMs,
      payload,
      raw: String(err),
      error: String(err),
    }
  }

  const latencyMs = performance.now() - start
  const raw = await response.text()

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      statusText: response.statusText,
      latencyMs,
      payload,
      raw,
      error: raw,
    }
  }

  let parsed: Record<string, unknown> | undefined
  try {
    parsed = JSON.parse(raw)
  } catch {
    // leave parsed undefined
  }

  return {
    ok: true,
    status: response.status,
    statusText: response.statusText,
    latencyMs,
    payload,
    raw,
    parsed,
  }
}
