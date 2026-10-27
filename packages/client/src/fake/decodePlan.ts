import { jpegSize } from '@session/basic-types'

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

/**
 * The plan for bytes the fake serves. Every picture it serves is a JPEG dev photograph, so a
 * JPEG's frame header is all it reads, and anything else is unmeasured.
 */
export function fakeDecodePlan(bytes: Uint8Array): DecodePlan {
  const size = jpegSize(bytes)
  return size === null ? UNMEASURED : decodePlan('image/jpeg', size.width, size.height)
}
