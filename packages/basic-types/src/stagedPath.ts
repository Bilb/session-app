/** The longest staged path served, in UTF-8 bytes: Linux's `PATH_MAX`. */
const MAX_STAGED_PATH_BYTES = 4096

/** A string's UTF-8 bytes, or null when it holds a lone surrogate. */
export function utf8Bytes(text: string): number[] | null {
  const bytes: number[] = []
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0
    // A lone surrogate, which no file system name can hold and UTF-8 cannot carry.
    if (code >= 0xd800 && code <= 0xdfff) return null
    if (code < 0x80) bytes.push(code)
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f))
    else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      )
    }
  }
  return bytes
}

/** Strict UTF-8: no overlong form, surrogate, value past U+10FFFF or truncated sequence. */
export function fromUtf8(bytes: readonly number[]): string | null {
  let out = ''
  for (let i = 0; i < bytes.length;) {
    const lead = bytes[i] ?? 0
    const length =
      lead < 0x80
        ? 1
        : lead >= 0xc2 && lead <= 0xdf
          ? 2
          : lead >= 0xe0 && lead <= 0xef
            ? 3
            : lead >= 0xf0 && lead <= 0xf4
              ? 4
              : 0
    if (length === 0 || i + length > bytes.length) return null
    let code = length === 1 ? lead : lead & (0xff >> (length + 1))
    for (let k = 1; k < length; k += 1) {
      const next = bytes[i + k] ?? 0
      if ((next & 0xc0) !== 0x80) return null
      code = (code << 6) | (next & 0x3f)
    }
    const least = [0, 0, 0x80, 0x800, 0x10000][length] ?? 0
    if (code < least || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return null
    out += String.fromCodePoint(code)
    i += length
  }
  return out
}

/**
 * A path the shim's `is_staged_path` accepts, so one it will make a staged thumbnail of: absolute,
 * POSIX or a Windows drive path, with no `.` or `..` part, no NUL, and short enough. UNC and
 * device paths are refused, since opening one on Windows reaches across the network.
 */
export function isStagedPath(path: string): boolean {
  const bytes = utf8Bytes(path)
  if (bytes === null || bytes.length > MAX_STAGED_PATH_BYTES || path.includes('\0')) return false
  // Either slash separates on Windows, so `/\host` is as much a share as `\\host`.
  const posix = path.startsWith('/') && !/^.[\\/]/.test(path)
  const drive = /^[A-Za-z]:[\\/]/.test(path)
  if (!posix && !drive) return false
  return path.split(/[\\/]/).every((part) => part !== '.' && part !== '..')
}
