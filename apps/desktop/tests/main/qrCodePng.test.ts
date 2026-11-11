import { inflateSync } from 'node:zlib'

import { describe, expect, it } from 'vitest'

import { qrCodePng } from '#src/main/qrCodePng'

/** The width, height and first row of pixels of a PNG `encodePng` wrote (one IDAT, filter 0). */
function decode(png: Uint8Array): { width: number; height: number; firstRow: Uint8Array } {
  const view = new DataView(png.buffer, png.byteOffset)
  const width = view.getUint32(16)
  const height = view.getUint32(20)
  const idatLength = view.getUint32(33)
  const raw = inflateSync(png.subarray(41, 41 + idatLength))
  return { width, height, firstRow: raw.subarray(1, 1 + width * 4) }
}

describe('qrCodePng', () => {
  it('draws a square code with a white quiet zone around it', () => {
    const { width, height, firstRow } = decode(qrCodePng('0123456789abcdef0123456789abcdef'))
    expect(width).toBe(height)
    expect(width % 16).toBe(0)
    expect(firstRow.every((byte) => byte === 255)).toBe(true)
  })
})
