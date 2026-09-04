import type { Base64String, HexString } from './brandedStrings'
import { utf8Decode, utf8Encode } from './string'

const HEX_CHARS = '0123456789abcdef'

// Base64 alphabet and pre-computed decode table (char code → 6-bit value, 255 = invalid)
const B64_ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const B64_DEC: Uint8Array = (() => {
  const t = new Uint8Array(128).fill(255)
  for (let i = 0; i < 64; i++) {
    t[B64_ALPHA.charCodeAt(i)] = i
  }
  return t
})()

export function toHex(d: Uint8Array): HexString {
  let s = ''
  for (let i = 0; i < d.length; i++) {
    const byte = d[i]!
    s += HEX_CHARS[byte >> 4]! + HEX_CHARS[byte & 0xf]!
  }
  return s as HexString
}

export function fromHex(d: HexString): Uint8Array {
  const len = d.length
  const result = new Uint8Array(Math.floor(len / 2))
  for (let i = 0; i < len; i += 2) {
    result[i >> 1] = parseInt(d.slice(i, i + 2), 16)
  }
  return result
}

export function fromHexStringToUint8Array(hexString: HexString): Uint8Array {
  return fromHex(hexString)
}

export function fromUInt8ArrayToBase64(d: Uint8Array): Base64String {
  let s = ''
  const len = d.length
  for (let i = 0; i < len; i += 3) {
    const a = d[i]!
    const b = i + 1 < len ? d[i + 1]! : 0
    const c = i + 2 < len ? d[i + 2]! : 0
    s += B64_ALPHA[a >> 2]!
    s += B64_ALPHA[((a & 3) << 4) | (b >> 4)]!
    s += i + 1 < len ? B64_ALPHA[((b & 15) << 2) | (c >> 6)]! : '='
    s += i + 2 < len ? B64_ALPHA[c & 63]! : '='
  }
  return s as Base64String
}

export function fromBase64ToUInt8Array(d: Base64String): Uint8Array {
  const stripped = (d as string).replace(/=+$/, '')
  const len = stripped.length
  const out = new Uint8Array(Math.floor((len * 3) / 4))
  let o = 0
  for (let i = 0; i < len; i += 4) {
    const a = B64_DEC[stripped.charCodeAt(i)] ?? 0
    const b = i + 1 < len ? (B64_DEC[stripped.charCodeAt(i + 1)] ?? 0) : 0
    const c = i + 2 < len ? (B64_DEC[stripped.charCodeAt(i + 2)] ?? 0) : 0
    const e = i + 3 < len ? (B64_DEC[stripped.charCodeAt(i + 3)] ?? 0) : 0
    out[o++] = (a << 2) | (b >> 4)
    if (i + 2 < len) {
      out[o++] = ((b & 15) << 4) | (c >> 2)
    }
    if (i + 3 < len) {
      out[o++] = ((c & 3) << 6) | e
    }
  }
  return out
}

export function fromUtf8ToUInt8Array(d: string): Uint8Array {
  return utf8Encode(d)
}

export function isBase64(str: string): str is Base64String {
  return /^[A-Za-z0-9+/]+={0,2}$/.test(str)
}

export function isHex(str: string): str is HexString {
  return /^[0-9A-Fa-f]+$/.test(str)
}

export function createBase64String(value: string): Base64String {
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    return value as Base64String
  }
  throw new Error('createBase64String: invalid base64 string')
}

export function createHexString(value: string): HexString {
  if (/^[0-9A-Fa-f]+$/.test(value)) {
    return value as HexString
  }
  throw new Error('createHexString: invalid hex string')
}

export function decodeBase64(encoded: Base64String): string {
  return utf8Decode(fromBase64ToUInt8Array(encoded))
}

export function decodeHex(encoded: HexString): string {
  return utf8Decode(fromHex(encoded))
}
