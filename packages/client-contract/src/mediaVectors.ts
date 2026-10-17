/**
 * What every reader of the media scheme must accept and refuse: `@session/app`'s `parseMediaUrl`
 * and desktop's `servableContentType` in TypeScript, and the shim's `parse_media_url` and
 * `servable_content_type` in C++, which both mobile loaders call. The C++ half is held to this
 * table by every test that runs the shim against it.
 */

export interface MediaUrlVector {
  url: string
  /** What it parses to, or null for a URL that must be refused. */
  parsed: ParsedAttachmentVector | ParsedStagedVector | null
}

interface ParsedAttachmentVector {
  kind: 'attachment' | 'thumbhash' | 'thumbnail' | 'rendition'
  messageId: number
  index: number
}

interface ParsedStagedVector {
  kind: 'staged'
  path: string
}

const S = 'session-media://'
const STAGED = `${S}staged/`

export const MEDIA_URL_VECTORS: readonly MediaUrlVector[] = [
  { url: `${S}attachment/1/0`, parsed: { kind: 'attachment', messageId: 1, index: 0 } },
  { url: `${S}attachment/42/7`, parsed: { kind: 'attachment', messageId: 42, index: 7 } },
  { url: `${S}thumbhash/42/0`, parsed: { kind: 'thumbhash', messageId: 42, index: 0 } },
  { url: `${S}thumbnail/42/1`, parsed: { kind: 'thumbnail', messageId: 42, index: 1 } },
  { url: `${S}rendition/42/3`, parsed: { kind: 'rendition', messageId: 42, index: 3 } },
  {
    url: `${S}attachment/9007199254740991/0`,
    parsed: { kind: 'attachment', messageId: Number.MAX_SAFE_INTEGER, index: 0 },
  },
  {
    url: `${S}thumbhash/1/9007199254740991`,
    parsed: { kind: 'thumbhash', messageId: 1, index: Number.MAX_SAFE_INTEGER },
  },

  // Another scheme, whatever its shape.
  { url: 'file:///etc/passwd', parsed: null },
  { url: 'http://attachment/42/1', parsed: null },
  { url: 'session-media:attachment/42/1', parsed: null },
  { url: 'session-media:/attachment/42/1', parsed: null },
  // The canonical form only: Chromium lowercases before a handler sees it.
  { url: 'SESSION-MEDIA://attachment/42/1', parsed: null },
  { url: `${S}Attachment/42/1`, parsed: null },

  // An authority it does not serve, or one with more in it than the word.
  { url: `${S}thumbnails/42/1`, parsed: null },
  { url: `${S}Thumbnail/42/1`, parsed: null },
  { url: `${S}renditions/42/1`, parsed: null },
  { url: `${S}Rendition/42/1`, parsed: null },
  { url: `${S}rendition/0/1`, parsed: null },
  { url: `${S}thumbnail:80/42/1`, parsed: null },
  { url: `${S}42/1`, parsed: null },
  { url: `${S}attachment:80/42/1`, parsed: null },
  { url: `${S}user@attachment/42/1`, parsed: null },

  // Anything but the pair.
  { url: `${S}attachment/42/1/original`, parsed: null },
  { url: `${S}attachment/42/1/`, parsed: null },
  { url: `${S}attachment/42`, parsed: null },
  { url: `${S}attachment//42/1`, parsed: null },
  { url: `${S}attachment/./42/1`, parsed: null },

  // A message id is a rowid, so zero names nothing; an index counts from zero.
  { url: `${S}attachment/0/1`, parsed: null },
  { url: `${S}attachment/-1/0`, parsed: null },
  { url: `${S}attachment/42/-1`, parsed: null },

  // Only plain decimal ids.
  ...[
    '4.2/0',
    'nine/0',
    '42/',
    '0x2A/1',
    '1e1/0',
    '+42/0',
    '42/-0',
    '042/1',
    '42/01',
    '%34%32/1',
  ].map((pair) => ({ url: `${S}attachment/${pair}`, parsed: null })),
  { url: `${S}attachment/ 42/1`, parsed: null },
  // ASCII digits only: not Arabic-Indic, not fullwidth.
  { url: `${S}attachment/\u0664\u0662/1`, parsed: null },
  { url: `${S}attachment/\uff14\uff12/1`, parsed: null },

  // Past the largest safe integer, which Number() would round rather than refuse.
  { url: `${S}attachment/9007199254740992/0`, parsed: null },
  { url: `${S}attachment/9007199254740993/0`, parsed: null },
  { url: `${S}attachment/42/9007199254740993`, parsed: null },
  { url: `${S}attachment/12345678901234567/0`, parsed: null },

  { url: `${S}attachment/42/1?x=1`, parsed: null },
  { url: `${S}attachment/42/1#f`, parsed: null },
  // Nothing past the pair, not even a byte a C string would end at or a line would.
  { url: `${S}attachment/1/0\0`, parsed: null },
  { url: `${S}attachment/1/0\n`, parsed: null },
  { url: `${S}/`, parsed: null },
  { url: S, parsed: null },
  { url: '', parsed: null },
  { url: 'not a url', parsed: null },

  // A staged file: the absolute path as one segment, every byte outside the unreserved set
  // escaped in uppercase hex.
  {
    url: `${STAGED}%2Fhome%2Fa%2Fphoto.jpg`,
    parsed: { kind: 'staged', path: '/home/a/photo.jpg' },
  },
  {
    url: `${STAGED}%2Fhome%2Fa%2F%D0%A4%D0%BE%D1%82%D0%BE%2F%C3%A7%C3%A0%20%E6%97%A5%E6%9C%AC.jpg`,
    parsed: {
      kind: 'staged',
      path: '/home/a/\u0424\u043e\u0442\u043e/\u00e7\u00e0 \u65e5\u672c.jpg',
    },
  },
  {
    url: `${STAGED}%2Ftmp%2F%F0%9F%93%B7.png`,
    parsed: { kind: 'staged', path: '/tmp/\u{1f4f7}.png' },
  },
  {
    url: `${STAGED}C%3A%5CUsers%5CZo%C3%AB%5Cx.png`,
    parsed: { kind: 'staged', path: 'C:\\Users\\Zo\u00eb\\x.png' },
  },
  { url: `${STAGED}C%3A%2Fx.png`, parsed: { kind: 'staged', path: 'C:/x.png' } },
  { url: `${STAGED}%2Fa~b_c-d.e`, parsed: { kind: 'staged', path: '/a~b_c-d.e' } },
  { url: `${STAGED}%2F100%25.jpg`, parsed: { kind: 'staged', path: '/100%.jpg' } },
  { url: `${STAGED}c%3A%5Cx.png`, parsed: { kind: 'staged', path: 'c:\\x.png' } },

  // One spelling per path: lowercase hex, an escaped unreserved byte, a raw reserved one.
  { url: `${STAGED}%2fhome%2Fa.jpg`, parsed: null },
  { url: `${STAGED}%2F%41.jpg`, parsed: null },
  { url: `${STAGED}/etc/passwd`, parsed: null },
  { url: `${STAGED}%2Fa b.jpg`, parsed: null },
  { url: `${STAGED}%2Fa%2`, parsed: null },
  { url: `${STAGED}%2Fa%GG`, parsed: null },
  // UTF-8 only: NUL, overlong, surrogate, past U+10FFFF, truncated.
  { url: `${STAGED}%2Fa%00.jpg`, parsed: null },
  { url: `${STAGED}%2Fa%C0%AF.jpg`, parsed: null },
  { url: `${STAGED}%2Fa%ED%A0%80.jpg`, parsed: null },
  { url: `${STAGED}%2Fa%F4%90%80%80.jpg`, parsed: null },
  { url: `${STAGED}%2Fa%E2%82`, parsed: null },
  { url: `${STAGED}%2Fa%FF`, parsed: null },
  // Absolute paths only, and none that reaches across a network or climbs out.
  { url: `${STAGED}a.jpg`, parsed: null },
  { url: `${STAGED}%5C%5Cserver%5Cshare%5Ca.jpg`, parsed: null },
  { url: `${STAGED}%5C%5C%3F%5CC%3A%5Ca.jpg`, parsed: null },
  { url: `${STAGED}%2F%2Fhost%2Fa.jpg`, parsed: null },
  // Either slash separates on Windows, in any pairing.
  { url: `${STAGED}%2F%5Chost%5Cshare%5Ca.jpg`, parsed: null },
  { url: `${STAGED}%2F%5C%3F%5CC%3A%5Ca.jpg`, parsed: null },
  { url: `${STAGED}%5C%2Fhost%2Fa.jpg`, parsed: null },
  { url: `${STAGED}%5Ca.jpg`, parsed: null },
  { url: `${STAGED}C%3Ax.png`, parsed: null },
  { url: `${STAGED}%2Fa%2F..%2Fb.jpg`, parsed: null },
  { url: `${STAGED}%2Fa%2F.%2Fb.jpg`, parsed: null },
  { url: `${STAGED}C%3A%5Ca%5C..%5Cb.jpg`, parsed: null },
  { url: STAGED, parsed: null },
  { url: `${S}staged`, parsed: null },
  { url: `${STAGED}%2Fa.jpg?x=1`, parsed: null },
  { url: `${STAGED}%2Fa.jpg#f`, parsed: null },
  { url: `${STAGED}%2Fa.jpg\n`, parsed: null },
  { url: `${S}Staged/%2Fa.jpg`, parsed: null },
  { url: `${STAGED}%2F${'a'.repeat(4096)}`, parsed: null },
  {
    url: `${STAGED}%2F${'a'.repeat(4095)}`,
    parsed: { kind: 'staged', path: `/${'a'.repeat(4095)}` },
  },
]

function ascii(text: string, length = 16): Uint8Array {
  const out = new Uint8Array(Math.max(length, text.length))
  for (let i = 0; i < text.length; i += 1) out[i] = text.charCodeAt(i)
  return out
}

const PNG = ascii('\x89PNG\r\n\x1a\n\0\0\0\rIHDR')
const JPEG = ascii('\xff\xd8\xff\xe0\0\x10JFIF')
const GIF87 = ascii('GIF87a')
const GIF89 = ascii('GIF89a')
const WEBP = ascii('RIFF\x24\0\0\0WEBPVP8 ')
const BMP = ascii('BM\x36\0\0\0')
const MP4 = ascii('\0\0\0\x18ftypmp42')
const WEBM = ascii('\x1a\x45\xdf\xa3')
const OGG = ascii('OggS\0\x02')
const SVG = ascii('<svg xmlns="http://www.w3.org/2000/svg"></svg>')

export interface ServableVector {
  declared: string
  bytes: Uint8Array
  /** The type the bytes are handed on as, or null for bytes that must not reach a decoder. */
  served: string | null
}

export const SERVABLE_VECTORS: readonly ServableVector[] = [
  { declared: 'image/png', bytes: PNG, served: 'image/png' },
  { declared: 'image/jpeg', bytes: JPEG, served: 'image/jpeg' },
  { declared: 'image/jpg', bytes: JPEG, served: 'image/jpeg' },
  { declared: 'image/gif', bytes: GIF87, served: 'image/gif' },
  { declared: 'image/gif', bytes: GIF89, served: 'image/gif' },
  { declared: 'image/webp', bytes: WEBP, served: 'image/webp' },
  { declared: 'image/bmp', bytes: BMP, served: 'image/bmp' },
  { declared: 'image/apng', bytes: PNG, served: 'image/png' },
  { declared: 'video/mp4', bytes: MP4, served: 'video/mp4' },
  { declared: 'video/webm', bytes: WEBM, served: 'video/webm' },
  { declared: 'video/ogg', bytes: OGG, served: 'video/ogg' },
  { declared: 'Image/PNG; charset=binary', bytes: PNG, served: 'image/png' },
  { declared: '  image/png  ', bytes: PNG, served: 'image/png' },
  // Only space, tab, CR and LF are trimmed off a declared type, on every platform.
  { declared: '\u00a0image/png', bytes: PNG, served: null },
  { declared: '\fimage/png\v', bytes: PNG, served: null },
  // A NUL ends no type: one carrying it is on no list.
  { declared: 'image/png\0', bytes: PNG, served: null },
  { declared: 'image/png\0.exe', bytes: PNG, served: null },

  // The wrong image format named: what the bytes are is what is served.
  { declared: 'image/png', bytes: JPEG, served: 'image/jpeg' },
  { declared: 'video/webm', bytes: MP4, served: 'video/mp4' },

  // SVG is a document that can carry script, whatever the bytes are.
  { declared: 'image/svg+xml', bytes: SVG, served: null },
  { declared: 'image/svg+xml', bytes: PNG, served: null },

  // A type that is not viewable.
  { declared: 'application/octet-stream', bytes: PNG, served: null },
  { declared: 'text/html', bytes: PNG, served: null },
  { declared: '', bytes: PNG, served: null },
  { declared: 'image/', bytes: PNG, served: null },

  // Bytes that are not the declared family.
  { declared: 'image/png', bytes: SVG, served: null },
  { declared: 'image/png', bytes: ascii('<html><script>'), served: null },
  { declared: 'image/png', bytes: MP4, served: null },
  { declared: 'video/mp4', bytes: PNG, served: null },

  // Too short to carry a signature.
  { declared: 'image/png', bytes: new Uint8Array(), served: null },
  { declared: 'image/png', bytes: PNG.subarray(0, 4), served: null },
  { declared: 'image/webp', bytes: ascii('RIFF', 4), served: null },
  { declared: 'video/mp4', bytes: MP4.subarray(0, 7), served: null },
]
