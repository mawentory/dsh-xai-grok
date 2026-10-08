/**
 * xAI Responses rejects images whose width×height is under 512 pixels.
 * Official understanding docs only publish the 20 MiB cap; the API still
 * returns: "Image has N total pixels (WxH), which is below the minimum of
 * 512 pixels." DSH never upscales, so a 16×24 chip is sent as-is.
 * @see https://docs.x.ai/developers/model-capabilities/images/understanding
 */
import { PNG } from 'pngjs'
import jpeg from 'jpeg-js'

/** xAI vision floor: width times height. */
export const XAI_MIN_IMAGE_PIXELS = 512

const DATA_URL = /^data:image\/(png|jpeg|jpg);base64,([A-Za-z0-9+/=\s]+)$/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function scaleForMinPixels(width: number, height: number): number {
  const area = width * height
  if (area >= XAI_MIN_IMAGE_PIXELS) return 1
  return Math.ceil(Math.sqrt(XAI_MIN_IMAGE_PIXELS / area))
}

function nearestNeighbor(
  src: Uint8Array,
  srcWidth: number,
  srcHeight: number,
  scale: number,
  channels: number,
): Uint8Array {
  const dstWidth = srcWidth * scale
  const dstHeight = srcHeight * scale
  const dst = new Uint8Array(dstWidth * dstHeight * channels)
  for (let y = 0; y < dstHeight; y++) {
    const sy = Math.min(srcHeight - 1, Math.floor(y / scale))
    for (let x = 0; x < dstWidth; x++) {
      const sx = Math.min(srcWidth - 1, Math.floor(x / scale))
      const si = (sy * srcWidth + sx) * channels
      const di = (y * dstWidth + x) * channels
      dst.set(src.subarray(si, si + channels), di)
    }
  }
  return dst
}

/** Enlarge a PNG or JPEG so width×height is at least 512. Other bytes pass through. */
export function ensureMinImagePixels(bytes: Uint8Array, mime: string): Uint8Array {
  const kind = mime.toLowerCase()
  try {
    if (kind === 'png') {
      const png = PNG.sync.read(Buffer.from(bytes))
      const scale = scaleForMinPixels(png.width, png.height)
      if (scale === 1) return bytes
      const out = new PNG({ width: png.width * scale, height: png.height * scale })
      out.data = Buffer.from(nearestNeighbor(png.data, png.width, png.height, scale, 4))
      return PNG.sync.write(out)
    }
    if (kind === 'jpeg' || kind === 'jpg') {
      const decoded = jpeg.decode(Buffer.from(bytes), { useTArray: true })
      const scale = scaleForMinPixels(decoded.width, decoded.height)
      if (scale === 1) return bytes
      const data = nearestNeighbor(decoded.data, decoded.width, decoded.height, scale, 4)
      return jpeg.encode({
        data: Buffer.from(data),
        width: decoded.width * scale,
        height: decoded.height * scale,
      }, 90).data
    }
  } catch {
    return bytes
  }
  return bytes
}

function rewriteDataUrl(value: string): string {
  const match = DATA_URL.exec(value)
  if (match === null) return value
  const mime = match[1]!.toLowerCase()
  const raw = Buffer.from(match[2]!.replace(/\s/g, ''), 'base64')
  const next = ensureMinImagePixels(raw, mime)
  if (next === raw || (next.byteLength === raw.byteLength && Buffer.from(next).equals(raw))) {
    return value
  }
  const outMime = mime === 'jpg' || mime === 'jpeg' ? 'jpeg' : 'png'
  return `data:image/${outMime};base64,${Buffer.from(next).toString('base64')}`
}

function rewriteValue(value: unknown): unknown {
  if (typeof value === 'string') return rewriteDataUrl(value)
  if (Array.isArray(value)) return value.map(rewriteValue)
  if (isRecord(value)) {
    const next: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(value)) next[key] = rewriteValue(child)
    return next
  }
  return value
}

/** Walk a JSON Responses body and upscale undersized data-URL images. */
export function withMinImagePixels(body: string): string {
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return body
  }
  const next = rewriteValue(parsed)
  if (next === parsed) return body
  return JSON.stringify(next)
}
