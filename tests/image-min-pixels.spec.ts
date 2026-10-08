import { PNG } from 'pngjs'
import { describe, expect, it } from 'vitest'
import {
  ensureMinImagePixels,
  withMinImagePixels,
  XAI_MIN_IMAGE_PIXELS,
} from '../src/image-min-pixels.ts'

function solidPng(width: number, height: number): Buffer {
  const png = new PNG({ width, height })
  png.data.fill(255)
  return PNG.sync.write(png)
}

describe('ensureMinImagePixels', () => {
  it('upscales a 16×24 PNG past the xAI 512-pixel floor', () => {
    const raw = solidPng(16, 24)
    expect(16 * 24).toBeLessThan(XAI_MIN_IMAGE_PIXELS)
    const out = PNG.sync.read(Buffer.from(ensureMinImagePixels(raw, 'png')))
    expect(out.width * out.height).toBeGreaterThanOrEqual(XAI_MIN_IMAGE_PIXELS)
    expect(out.width / out.height).toBeCloseTo(16 / 24)
  })

  it('leaves a large enough PNG unchanged', () => {
    const raw = solidPng(32, 32)
    const out = ensureMinImagePixels(raw, 'png')
    expect(Buffer.from(out).equals(raw)).toBe(true)
  })
})

describe('withMinImagePixels', () => {
  it('rewrites a data-URL image in an xAI responses body', () => {
    const raw = solidPng(16, 24)
    const body = JSON.stringify({
      model: 'grok-4.7',
      input: [{
        role: 'user',
        content: [{
          type: 'input_image',
          image_url: `data:image/png;base64,${raw.toString('base64')}`,
        }],
      }],
    })
    const next = JSON.parse(withMinImagePixels(body)) as {
      input: Array<{ content: Array<{ image_url: string }> }>
    }
    const url = next.input[0]!.content[0]!.image_url
    const encoded = url.slice('data:image/png;base64,'.length)
    const png = PNG.sync.read(Buffer.from(encoded, 'base64'))
    expect(png.width * png.height).toBeGreaterThanOrEqual(XAI_MIN_IMAGE_PIXELS)
  })

  it('leaves a non-JSON body alone', () => {
    expect(withMinImagePixels('not-json')).toBe('not-json')
  })
})
