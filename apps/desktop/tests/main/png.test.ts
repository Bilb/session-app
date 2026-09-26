import { inflateSync } from 'node:zlib'

import { describe, expect, it } from 'vitest'

import { encodePng } from '#src/main/png'

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

interface Chunk {
  type: string
  data: Uint8Array
  crc: number
}

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (const byte of bytes) {
    c ^= byte
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  }
  return (c ^ 0xffffffff) >>> 0
}

function chunks(png: Uint8Array): Chunk[] {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
  const out: Chunk[] = []
  for (let at = SIGNATURE.length; at < png.length;) {
    const length = view.getUint32(at)
    const type = String.fromCharCode(...png.subarray(at + 4, at + 8))
    out.push({
      type,
      data: png.subarray(at + 8, at + 8 + length),
      crc: view.getUint32(at + 8 + length),
    })
    at += 12 + length
  }
  return out
}

/** A 3x2 image whose every byte differs, so a misplaced row or channel shows. */
const WIDTH = 3
const HEIGHT = 2
const RGBA = Uint8Array.from({ length: WIDTH * HEIGHT * 4 }, (_, i) => (i * 37 + 11) & 0xff)

describe('the placeholder PNG encoder', () => {
  const png = encodePng(WIDTH, HEIGHT, RGBA)

  it('starts with the PNG signature and holds IHDR, IDAT, IEND in that order', () => {
    expect([...png.subarray(0, 8)]).toEqual(SIGNATURE)
    expect(chunks(png).map((c) => c.type)).toEqual(['IHDR', 'IDAT', 'IEND'])
  })

  it('declares the size, 8-bit RGBA, and method 0 for compression, filter and interlace', () => {
    const ihdr = chunks(png)[0]?.data ?? new Uint8Array()
    const view = new DataView(ihdr.buffer, ihdr.byteOffset, ihdr.byteLength)
    expect(ihdr.length).toBe(13)
    expect(view.getUint32(0)).toBe(WIDTH)
    expect(view.getUint32(4)).toBe(HEIGHT)
    expect([...ihdr.subarray(8)]).toEqual([8, 6, 0, 0, 0])
  })

  it('carries a correct CRC on every chunk', () => {
    for (const { type, data, crc } of chunks(png)) {
      const covered = new Uint8Array(4 + data.length)
      for (let i = 0; i < 4; i += 1) covered[i] = type.charCodeAt(i)
      covered.set(data, 4)
      expect(crc, type).toBe(crc32(covered))
    }
  })

  it('inflates back to unfiltered rows of the same pixels', () => {
    const idat = chunks(png).find((c) => c.type === 'IDAT')?.data ?? new Uint8Array()
    const raw = new Uint8Array(inflateSync(idat))
    const stride = WIDTH * 4
    expect(raw.length).toBe((stride + 1) * HEIGHT)
    for (let y = 0; y < HEIGHT; y += 1) {
      const row = y * (stride + 1)
      expect(raw[row], `filter byte of row ${String(y)}`).toBe(0)
      expect([...raw.subarray(row + 1, row + 1 + stride)]).toEqual([
        ...RGBA.subarray(y * stride, (y + 1) * stride),
      ])
    }
  })

  it('refuses pixels that do not match the size', () => {
    expect(() => encodePng(WIDTH, HEIGHT, RGBA.subarray(4))).toThrow()
    expect(() => encodePng(WIDTH, HEIGHT, new Uint8Array(RGBA.length + 4))).toThrow()
  })
})
