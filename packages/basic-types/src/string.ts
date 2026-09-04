export function utf8Encode(str: string): Uint8Array {
  const bytes: number[] = []
  for (let i = 0; i < str.length;) {
    let cp = str.charCodeAt(i++)
    if (cp >= 0xd800 && cp <= 0xdbff) {
      cp = 0x10000 + ((cp - 0xd800) << 10) + (str.charCodeAt(i++) - 0xdc00)
    }
    if (cp < 0x80) {
      bytes.push(cp)
    } else if (cp < 0x800) {
      bytes.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f))
    } else if (cp < 0x10000) {
      bytes.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f))
    } else {
      bytes.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 0x3f),
        0x80 | ((cp >> 6) & 0x3f),
        0x80 | (cp & 0x3f),
      )
    }
  }
  return new Uint8Array(bytes)
}

export function utf8Decode(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = new Uint8Array(buffer)
  let out = ''
  let i = 0
  while (i < bytes.length) {
    const b = bytes[i]!
    if (b < 0x80) {
      out += String.fromCharCode(b)
      i++
    } else if (b < 0xe0) {
      out += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i + 1]! & 0x3f))
      i += 2
    } else if (b < 0xf0) {
      out += String.fromCharCode(
        ((b & 0x0f) << 12) | ((bytes[i + 1]! & 0x3f) << 6) | (bytes[i + 2]! & 0x3f),
      )
      i += 3
    } else {
      // 4-byte → surrogate pair
      const cp =
        ((b & 0x07) << 18) |
        ((bytes[i + 1]! & 0x3f) << 12) |
        ((bytes[i + 2]! & 0x3f) << 6) |
        (bytes[i + 3]! & 0x3f)
      const adj = cp - 0x10000
      out += String.fromCharCode(0xd800 + (adj >> 10), 0xdc00 + (adj & 0x3ff))
      i += 4
    }
  }
  return out
}
