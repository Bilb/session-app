import { encode } from 'uqr'

import { encodePng } from './png'

/** The longest text main will draw: a recovery password's seed is 32 or 64 characters. */
export const MAX_QR_TEXT_CHARS = 256

/** Pixels per module, so a saved code prints and scans at any reasonable size. */
const MODULE_PX = 16
/** Modules of white around the code: the quiet zone a scanner needs. */
const QUIET_MODULES = 4

/**
 * A QR code of `value` as a PNG: black modules on white, with its quiet zone, and no logo -- a
 * file is scanned by whatever someone points at it, not only by Session. Level Q, as drawn on
 * screen.
 */
export function qrCodePng(value: string): Uint8Array {
  const { size, data } = encode(value, { ecc: 'Q', border: QUIET_MODULES })
  const side = size * MODULE_PX
  const rgba = new Uint8Array(side * side * 4).fill(255)
  data.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (!dark) return
      for (let dy = 0; dy < MODULE_PX; dy += 1) {
        const start = ((y * MODULE_PX + dy) * side + x * MODULE_PX) * 4
        for (let i = 0; i < MODULE_PX * 4; i += 4) {
          rgba[start + i] = 0
          rgba[start + i + 1] = 0
          rgba[start + i + 2] = 0
        }
      }
    })
  })
  return encodePng(side, side, rgba)
}
