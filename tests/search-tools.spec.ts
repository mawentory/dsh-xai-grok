import { afterEach, describe, expect, it } from 'vitest'
import { installXaiSearchTools, isXaiResponsesRequest, withSearchTools } from '../src/search-tools.ts'

describe('withSearchTools', () => {
  it('adds web_search and x_search to a Grok responses body', () => {
    const body = withSearchTools(JSON.stringify({
      model: 'grok-4.7',
      input: [{ role: 'user', content: 'latest launch' }],
      tools: [{ type: 'function', name: 'read' }],
    }))
    const tools = JSON.parse(body).tools as { type: string }[]
    expect(tools.map(tool => tool.type)).toEqual(['function', 'web_search', 'x_search'])
  })

  it('does not duplicate tools that are already present', () => {
    const original = JSON.stringify({ tools: [{ type: 'web_search' }, { type: 'x_search' }] })
    expect(withSearchTools(original)).toBe(original)
  })

  it('leaves a non-JSON body alone', () => {
    expect(withSearchTools('not-json')).toBe('not-json')
  })
})

describe('isXaiResponsesRequest', () => {
  it('matches only the xAI responses endpoint', () => {
    expect(isXaiResponsesRequest('https://api.x.ai/v1/responses')).toBe(true)
    expect(isXaiResponsesRequest('https://api.x.ai/v1/chat/completions')).toBe(false)
    expect(isXaiResponsesRequest('http://127.0.0.1:4000/v1/responses')).toBe(false)
  })
})

describe('installXaiSearchTools', () => {
  const original = globalThis.fetch
  afterEach(() => {
    globalThis.fetch = original
    delete (globalThis as { [key: symbol]: unknown })[Symbol.for('dsh-xai-grok.search-tools')]
  })

  it('rewrites an xAI responses fetch and leaves other requests unchanged', async () => {
    const seen: string[] = []
    globalThis.fetch = (async (_input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      seen.push(typeof init?.body === 'string' ? init.body : '')
      return new Response('{}')
    }) as typeof fetch
    installXaiSearchTools()
    await fetch('https://api.x.ai/v1/responses', {
      method: 'POST',
      body: JSON.stringify({ model: 'grok-4.6' }),
    })
    await fetch('http://127.0.0.1:4000/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify({ model: 'glm' }),
    })
    expect(JSON.parse(seen[0]!).tools).toEqual([{ type: 'web_search' }, { type: 'x_search' }])
    expect(JSON.parse(seen[1]!).tools).toBeUndefined()
  })
})
