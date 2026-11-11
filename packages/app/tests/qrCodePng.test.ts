import { inflateSync } from 'node:zlib'

import { describe, expect, it } from 'vitest'

import { qrCodePng } from '#src/qrCodePng'

/** The size, bit depth and first row of a one-IDAT, one-bit greyscale PNG, decoded by zlib. */
function decode(png: Uint8Array) {
  const view = new DataView(png.buffer, png.byteOffset)
  const width = view.getUint32(16)
  const height = view.getUint32(20)
  const idatLength = view.getUint32(33)
  const raw = inflateSync(png.subarray(41, 41 + idatLength))
  const rowBytes = Math.ceil(width / 8)
  return { width, height, depth: png[24], raw, rowBytes, firstRow: raw.subarray(1, 1 + rowBytes) }
}

describe('qrCodePng', () => {
  it('draws a square code with a white quiet zone around it', () => {
    const { width, height, depth, raw, rowBytes, firstRow } = decode(
      qrCodePng('0123456789abcdef0123456789abcdef'),
    )
    expect(width).toBe(height)
    expect(width % 16).toBe(0)
    expect(depth).toBe(1)
    // A standard zlib decoder accepts the stored blocks, and every row is there.
    expect(raw.length).toBe((rowBytes + 1) * height)
    // The top rows are quiet zone, all white; a dark module starts where the code does.
    expect(firstRow.every((byte, at) => byte === 255 || at === rowBytes - 1)).toBe(true)
    expect(raw.some((byte, at) => at % (rowBytes + 1) !== 0 && byte !== 255)).toBe(true)
  })

  it('spans more than one stored block for a long value', () => {
    const { raw, rowBytes, height } = decode(qrCodePng('a'.repeat(200)))
    expect(raw.length).toBe((rowBytes + 1) * height)
    expect(raw.length).toBeGreaterThan(0xffff)
  })
})
