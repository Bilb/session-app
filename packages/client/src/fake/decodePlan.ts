import type { DecodePlan } from '../types'

/**
 * The shim's `decode_plan`, for the fake, which has no shim to ask. `DECODE_PLAN_VECTORS` holds
 * this and the C++ to one table, so the numbers below are the shim's `decode_bound.hpp`.
 */

const DECODE_PIXEL_BUDGET = 3072 * 2048
const WHOLE_DECODE_PIXEL_CEILING = 100_000_000

function decodeEdgeBound(width: number, height: number): number {
  if (!(width > 0 && height > 0)) return Math.floor(Math.sqrt(DECODE_PIXEL_BUDGET))
  const aspect = Math.max(width / height, height / width)
  return Math.min(Math.max(width, height), Math.floor(Math.sqrt(DECODE_PIXEL_BUDGET * aspect)))
}

const UNMEASURED: DecodePlan = {
  edgePx: decodeEdgeBound(0, 0),
  firstFrameOnly: true,
  exceedsWholeDecodeCeiling: false,
  measured: false,
}

/** The plan for a picture of `type` whose header says `width` by `height`. */
export function decodePlan(type: string, width: number, height: number): DecodePlan {
  if (!(width > 0 && height > 0)) return UNMEASURED
  const fits = width * height <= DECODE_PIXEL_BUDGET
  const wholeDecoded = type === 'image/gif' || type === 'image/png'
  return {
    edgePx: fits ? 0 : decodeEdgeBound(width, height),
    firstFrameOnly: !fits,
    exceedsWholeDecodeCeiling: wholeDecoded && width * height > WHOLE_DECODE_PIXEL_CEILING,
    measured: true,
  }
}

/** Start-of-frame markers, which carry a JPEG's size; C4, C8 and CC share the range and are not. */
const START_OF_FRAME = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
])

function jpegSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null
  let at = 2
  while (at + 9 < bytes.length) {
    if (bytes[at] !== 0xff) return null
    const marker = bytes[at + 1] ?? 0
    const length = ((bytes[at + 2] ?? 0) << 8) | (bytes[at + 3] ?? 0)
    if (START_OF_FRAME.has(marker)) {
      const height = ((bytes[at + 5] ?? 0) << 8) | (bytes[at + 6] ?? 0)
      const width = ((bytes[at + 7] ?? 0) << 8) | (bytes[at + 8] ?? 0)
      return { width, height }
    }
    at += 2 + length
  }
  return null
}

/**
 * The plan for bytes the fake serves. Every picture it serves is a JPEG dev photograph, so a
 * JPEG's frame header is all it reads, and anything else is unmeasured.
 */
export function fakeDecodePlan(bytes: Uint8Array): DecodePlan {
  const size = jpegSize(bytes)
  return size === null ? UNMEASURED : decodePlan('image/jpeg', size.width, size.height)
}
