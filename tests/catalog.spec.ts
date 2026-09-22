import { describe, expect, it } from 'vitest'
import { xaiProvider } from '@earendil-works/pi-ai/providers/xai'
import {
  extractModelIds,
  materializeLiveModel,
  mergeLiveCatalog,
  preferredXaiOAuthModelFrom,
  supportsXhigh,
} from '../src/catalog.ts'

const catalog = xaiProvider().getModels()

describe('extractModelIds', () => {
  it('reads OpenAI-shaped data arrays', () => {
    expect(extractModelIds({ data: [{ id: 'grok-4.6' }, { id: 'grok-4.5' }, { object: 'model' }] })).toEqual([
      'grok-4.6',
      'grok-4.5',
    ])
  })

  it('accepts a bare string list and a models field', () => {
    expect(extractModelIds(['grok-4.6', 'grok-4.6'])).toEqual(['grok-4.6'])
    expect(extractModelIds({ models: [{ id: 'grok-build-0.1' }] })).toEqual(['grok-build-0.1'])
  })
})

describe('mergeLiveCatalog', () => {
  it('keeps the installed catalog when live ids are missing', () => {
    expect(mergeLiveCatalog(catalog, undefined).map(model => model.id)).toEqual(catalog.map(model => model.id))
    expect(mergeLiveCatalog(catalog, []).map(model => model.id)).toEqual(catalog.map(model => model.id))
  })

  it('narrows to live ids and inherits catalog metadata', () => {
    const merged = mergeLiveCatalog(catalog, ['grok-4.5', 'grok-4.6'])
    expect(merged.map(model => model.id)).toEqual(['grok-4.5', 'grok-4.6'])
    const known = merged.find(model => model.id === 'grok-4.5')
    const extra = merged.find(model => model.id === 'grok-4.6')
    expect(known?.api).toBe('openai-responses')
    expect(extra?.api).toBe('openai-responses')
    expect(extra?.name).toBe('Grok 4.6')
  })
})

describe('materializeLiveModel', () => {
  it('uses the build template for code-fast ids', () => {
    const model = materializeLiveModel('grok-code-fast-1', catalog)
    expect(model.api).toBe(catalog.find(entry => entry.id === 'grok-build-0.1')?.api)
  })

  it('gives grok-4.7 the Responses template and xhigh, and leaves xhigh off grok-4.5', () => {
    const current = materializeLiveModel('grok-4.7', catalog)
    const previous = materializeLiveModel('grok-4.5', catalog)
    expect(current.api).toBe('openai-responses')
    expect(current.thinkingLevelMap?.xhigh).toBe('xhigh')
    expect(previous.thinkingLevelMap?.xhigh).toBeNull()
    expect(supportsXhigh('grok-4.6')).toBe(true)
    expect(supportsXhigh('grok-4.3')).toBe(false)
    expect(supportsXhigh('grok-build-0.1')).toBe(false)
  })
})

describe('preferredXaiOAuthModelFrom', () => {
  it('prefers grok-4.6 over grok-4.5', () => {
    expect(preferredXaiOAuthModelFrom([{ id: 'grok-4.5' }, { id: 'grok-4.6' }])).toBe('grok-4.6')
  })
})
