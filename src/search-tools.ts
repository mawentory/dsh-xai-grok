/**
 * Attach xAI's own server-side search tools to Grok Responses requests.
 * The model runs web_search and x_search. This plugin does not register an agent.
 * @module dsh-xai/search-tools
 */

const SEARCH_TOOL_TYPES = ['web_search', 'x_search'] as const
const INSTALLED = Symbol.for('dsh-xai-grok.search-tools')

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** True for an xAI Responses call, whichever base URL the client used. */
export function isXaiResponsesRequest(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.hostname === 'api.x.ai' && parsed.pathname.replace(/\/$/, '').endsWith('/responses')
  } catch {
    return false
  }
}

/** Name xAI will see. A function tool and a server tool must not share it. */
function toolName(tool: Record<string, unknown>): string | undefined {
  if (typeof tool['name'] === 'string') return tool['name']
  const fn = tool['function']
  if (isRecord(fn) && typeof fn['name'] === 'string') return fn['name']
  if (typeof tool['type'] === 'string' && tool['type'] !== 'function') return tool['type']
  return undefined
}

/**
 * Add server-side web_search and x_search when they are missing.
 * Drop a harness function tool that already uses one of those names.
 * Leaves the body unchanged when it is not a JSON object.
 */
export function withSearchTools(body: string): string {
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return body
  }
  if (!isRecord(parsed)) return body
  const existing = Array.isArray(parsed['tools']) ? parsed['tools'] : []
  const kept = existing.filter(tool => {
    if (!isRecord(tool)) return true
    if (tool['type'] === 'web_search' || tool['type'] === 'x_search') return true
    const name = toolName(tool)
    return name !== 'web_search' && name !== 'x_search'
  })
  const present = new Set(
    kept.filter(isRecord).map(tool => tool['type']).filter(type => type === 'web_search' || type === 'x_search'),
  )
  const missing = SEARCH_TOOL_TYPES.filter(type => !present.has(type)).map(type => ({ type }))
  const tools = [...kept, ...missing]
  if (missing.length === 0 && tools.length === existing.length && Array.isArray(parsed['tools'])) return body
  return JSON.stringify({ ...parsed, tools })
}

type FetchInput = Parameters<typeof fetch>[0]

function requestUrl(input: FetchInput): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  return input.url
}

function rewriteInit(input: FetchInput, init?: RequestInit): RequestInit | undefined {
  const url = requestUrl(input)
  if (!isXaiResponsesRequest(url) || typeof init?.body !== 'string') return init
  const body = withSearchTools(init.body)
  if (body === init.body) return init
  return { ...init, body }
}

/** Install one process-wide fetch wrapper. A second call does nothing. */
export function installXaiSearchTools(): void {
  const marker = globalThis as typeof globalThis & { [INSTALLED]?: true }
  if (marker[INSTALLED]) return
  const original = globalThis.fetch.bind(globalThis)
  globalThis.fetch = ((input: FetchInput, init?: RequestInit) => {
    return original(input, rewriteInit(input, init))
  }) as typeof fetch
  marker[INSTALLED] = true
}
