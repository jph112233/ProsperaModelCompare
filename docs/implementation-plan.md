# LLM API Playground - Implementation Plan

## Context

Build a local Next.js single-page web app for testing OpenAI-compatible chat completion APIs (OpenRouter, OpenAI, Groq, Ollama, etc.) with full parameter control, raw response inspection, equivalent cURL generation, and side-by-side model comparison. Browser calls the target API directly (no backend proxy). All persistence in localStorage. The current project directory is empty aside from Wagile metadata files, so this is a from-scratch scaffold.

## Tech stack

- Next.js 14 (app router) + TypeScript + Tailwind CSS
- No database, no backend route handlers (direct browser-to-API fetch)
- No external state library; React `useState` + a small localStorage hook

## Scaffold

Run inside the existing project directory (the dir is non-empty, so use a temp dir + merge, or scaffold in place):

```
npx create-next-app@14 . --ts --tailwind --app --eslint --import-alias "@/*" --no-git
```

If create-next-app refuses because of existing files (CLAUDE.md, backlog.md, etc.), scaffold into a temp folder and copy `app/`, `public/`, `package.json`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.js`, `next.config.mjs`, `next-env.d.ts`, `.gitignore`, `.eslintrc.json` into the project root.

## File-by-file plan

### `lib/api.ts`
Types and fetch wrapper. Critical exports:

- `type ResponseFormat = 'text' | 'json_object' | 'json_schema'`
- `type RequestConfig` - all knobs from the left panel (apiKey, baseUrl, model, systemPrompt, userPrompt, temperature, maxTokens, topP, frequencyPenalty, presencePenalty, seed, responseFormat, jsonSchemaText)
- `buildPayload(cfg: RequestConfig)` - returns the OpenAI-shaped body. System message included only if non-empty. `seed` only included if numeric. `response_format` only included if not `text`; `json_schema` parses `jsonSchemaText` as JSON and wraps as `{ type: 'json_schema', json_schema: <parsed> }`; `json_object` -> `{ type: 'json_object' }`.
- `buildCurl(cfg: RequestConfig, payload: object)` - returns multi-line `curl` string. Mask API key as `sk-...xxxx` (last 4 chars of original).
- `runCompletion(cfg: RequestConfig)` - performs `fetch(${baseUrl}/chat/completions, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey }, body: JSON.stringify(payload) })`, measures latency via `performance.now()`, returns `{ ok, status, statusText, latencyMs, payload, raw, parsed?, error? }` where `parsed` holds the JSON body when `ok`. On non-2xx, capture `await response.text()` as raw error body and surface as `error`. Only attach the `Authorization` header when `apiKey` is non-empty (so Ollama works without a key).

### `lib/storage.ts`
Tiny typed wrappers around `localStorage` with SSR safety (`typeof window === 'undefined'` guard). Single namespaced key `llm-playground:v1` storing a partial config blob. Persisted: apiKey, baseUrl, model (and modelB for compare), systemPrompt, all parameter values (temperature, maxTokens, topP, frequency/presence penalty, seed), responseFormat, jsonSchemaText. Not persisted: userPrompt. Export `loadPersisted()` and `savePersisted(patch)` that merges and writes synchronously.

### `components/Slider.tsx`
Labeled range input with a numeric readout on the right. Props: `label, value, onChange, min, max, step`. Tailwind styling, accessible label association.

### `components/ConfigPanel.tsx`
Left panel. Props: `config: RequestConfig`, `onChange(patch)`, `onRun()`, `running: boolean`, `hideSharedPrompts?: boolean` (used in compare mode where prompts move to a shared bar). Renders:
- API key (input type=password)
- Base URL (default `https://openrouter.ai/api/v1`)
- Model (free text)
- System + user prompts (textarea) - hidden when `hideSharedPrompts`
- 5 sliders + seed input
- Response format select; when JSON schema selected, render a textarea for the schema
- Run button (disabled while `running`, shows spinner)
- `onKeyDown` on the prompt textareas: `(Cmd|Ctrl)+Enter` calls `onRun()`

### `components/OutputPanel.tsx`
Right panel. Props: `result | null`, `loading`, `config`. Three tabs:
1. **Response**: latency + usage cards (`prompt_tokens`, `completion_tokens`, `total_tokens`, latency seconds), then `result.parsed.choices[0].message.content`. If config.responseFormat !== 'text', try `JSON.parse` -> pretty-print in `<pre>`; on parse failure fall back to plain text.
2. **Raw JSON**: pretty-printed full response (or error body) in `<pre>`.
3. **cURL**: pretty-printed `curl` string from `buildCurl`.
- Copy-to-clipboard button copies the active tab's text via `navigator.clipboard.writeText`.
- On error, the Response tab shows status code + statusText + raw body.

### `components/CompareView.tsx`
Two-column layout for compare mode. Owns local state for two `RequestConfig`s sharing systemPrompt, userPrompt, and responseFormat (+ jsonSchemaText) at the top level. Renders a shared bar (system + user textareas, response-format selector, Run-both button), then a two-column grid: each column = `<ConfigPanel hideSharedPrompts hideResponseFormat />` over `<OutputPanel />`. `runBoth()` calls `Promise.all([runCompletion(a), runCompletion(b)])`, setting per-column loading and result state.

### `app/page.tsx`
Top-level page. State:
- `compareMode: boolean` (toggle in header)
- single-mode: one `RequestConfig` + `result`
- compare-mode: delegates to `<CompareView />`

Wires persistence: on mount, hydrate from `loadPersisted()`; on relevant changes, write via `savePersisted`.

Header: title, compare-mode toggle. Body: either `<ConfigPanel />` + `<OutputPanel />` in a 2-col grid, or `<CompareView />`.

### `app/layout.tsx`
Standard Next.js layout with Tailwind globals + a sensible font (Inter via `next/font`). Title: "LLM API Playground".

## Critical files to be created

- `package.json`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.js`, `next.config.mjs`, `app/globals.css` (from scaffold)
- `app/layout.tsx`
- `app/page.tsx`
- `components/ConfigPanel.tsx`
- `components/OutputPanel.tsx`
- `components/CompareView.tsx`
- `components/Slider.tsx`
- `lib/api.ts`
- `lib/storage.ts`

## Build order

1. Scaffold Next.js + Tailwind
2. `lib/api.ts` (types, `buildPayload`, `buildCurl`, `runCompletion`)
3. `lib/storage.ts`
4. `components/Slider.tsx`
5. `components/ConfigPanel.tsx`
6. `components/OutputPanel.tsx`
7. `components/CompareView.tsx`
8. `app/page.tsx` wires single + compare modes
9. Polish: Cmd+Enter, copy button, JSON pretty-printing, spinner, key masking in cURL

## Style guardrails (per global prefs)

- No purple in the palette. Use a neutral slate/gray base with **emerald-600** as the single accent.
- No em dashes anywhere in UI copy or comments. Use hyphens.

## Verification

End-to-end smoke test using the running dev server (`npm run dev`, http://localhost:3000):

1. **OpenRouter happy path**: Paste an OpenRouter key, leave base URL default, set model to `openai/gpt-4o-mini`, system prompt "be terse", user prompt "say hi", click Run. Confirm Response tab shows token counts + reply, Raw JSON tab shows full body, cURL tab shows masked key.
2. **Persistence**: Reload the page; confirm API key, base URL, model, system prompt rehydrate from localStorage but the user prompt clears.
3. **Cmd+Enter**: Focus user prompt, press Cmd+Enter, confirm Run fires.
4. **Errors**: Set an invalid key; confirm status code + raw error body show in the Response tab without crashing.
5. **JSON mode**: Switch response format to JSON object, prompt for JSON output, confirm Response tab pretty-prints the parsed content.
6. **JSON schema**: Provide a schema in the textarea; confirm payload includes `response_format: { type: 'json_schema', json_schema: <parsed> }` (verify in cURL tab).
7. **Compare mode**: Toggle on, set two different models, confirm both fire in parallel and render side-by-side with independent token counts.
8. **Copy button**: On each tab, click Copy and paste into another field to confirm contents.
9. **Local model (optional)**: Point base URL at `http://localhost:11434/v1` with model `llama3.2` to validate Ollama compatibility (no Authorization header sent when key is blank).

## Decisions (from clarifying questions)

- Persist **all** config to localStorage (including sliders, seed, response format, json schema text) - not just the spec-listed fields.
- In compare mode, response format is **shared** above both columns (alongside system + user prompts). Per-column controls remain independent for everything else (model + sliders + seed).
- Accent color: **emerald-600** on a slate/gray base.
