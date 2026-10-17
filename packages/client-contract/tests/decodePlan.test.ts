import { decodePlan, fakeDecodePlan } from '@session/client/fake'
import jpeg from 'jpeg-js'
import { describe, expect, it } from 'vitest'

import { DECODE_PLAN_VECTORS } from '#src/index'

/** A JPEG's markers up to its frame header, which is all a size is read from. */
function jpegHeader(width: number, height: number): Uint8Array {
  return Uint8Array.from([
    0xff,
    0xd8,
    0xff,
    0xc0,
    0x00,
    0x11,
    0x08,
    height >> 8,
    height & 0xff,
    width >> 8,
    width & 0xff,
    0x03,
  ])
}

describe("the fake's decode plan", () => {
  it('plans every header as the shim does', () => {
    for (const { type, width, height, frames, plan } of DECODE_PLAN_VECTORS) {
      expect(
        decodePlan(type, width, height, frames),
        `${type} ${String(width)}x${String(height)}`,
      ).toEqual(plan)
    }
  })

  it('reads the size of a JPEG it serves', () => {
    const photo = jpeg.encode(
      { width: 1600, height: 1200, data: new Uint8Array(1600 * 1200 * 4).fill(0x80) },
      90,
    ).data
    expect(fakeDecodePlan(photo)).toEqual({
      edge: 0,
      firstFrameOnly: false,
      refused: false,
      measured: true,
    })
    expect(fakeDecodePlan(jpegHeader(4032, 3024))).toMatchObject({ edge: 2896, measured: true })
  })

  it('leaves anything but a JPEG unmeasured', () => {
    expect(fakeDecodePlan(new Uint8Array(64))).toMatchObject({ measured: false })
    expect(fakeDecodePlan(Uint8Array.from('GIF89a', (c) => c.charCodeAt(0)))).toMatchObject({
      measured: false,
    })
  })
})
