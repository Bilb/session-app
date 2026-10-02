import { bareFileName } from '@session/app/exportFileName'
import { utf8Encode } from '@session/basic-types'

/**
 * The rules that decide where an exported attachment may be written, with no expo in them.
 *
 * libsession's `save_attachment` writes wherever `destination` says and checks nothing, and the
 * name that goes into that path is the sender's. So everything here is about keeping a stranger's
 * filename from choosing the directory: a `../session.db` suggestion must land as a file called
 * `session.db` in a folder of its own, never on top of the database.
 */

const FALLBACK_NAME = 'attachment'

/** Well under the 255 bytes ext4, f2fs and APFS allow a name, leaving room for ` (1)`. */
const MAX_NAME_BYTES = 200

/** Longer than any real extension; past it the last dot is part of the stem, which the cap may cut. */
const MAX_EXTENSION_BYTES = 16

/**
 * What the photo library accepts, and the extension to give each.
 *
 * Narrower than the viewable list on purpose: neither Photos nor MediaStore takes WebM or Ogg,
 * and MediaStore files an asset by its extension, so a sender's `photo.exe` claiming to be JPEG
 * has to arrive as `photo.jpg` to be filed at all.
 */
const PHOTO_LIBRARY_TYPES: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/3gpp': '3gp',
}

/** The extension to file this under in the photo library, or null when it does not go there. */
export function photoLibraryExtension(contentType: string | undefined): string | null {
  const essence = contentType?.split(';')[0]?.trim().toLowerCase()
  return (essence === undefined ? undefined : PHOTO_LIBRARY_TYPES[essence]) ?? null
}

function fitsBytes(name: string): boolean {
  return utf8Encode(name).length <= MAX_NAME_BYTES
}

/** Shortens the stem, by code point, until the whole name fits; the extension survives. */
function capped(stem: string, extension: string): string {
  const suffix = extension === '' ? '' : `.${extension}`
  const points = Array.from(stem)
  while (points.length > 1 && !fitsBytes(points.join('') + suffix)) points.pop()
  return points.join('') + suffix
}

/**
 * A bare file name from the sender's suggestion: no directory part, no control characters, no
 * leading dots, bounded in length.
 *
 * A picture headed for the photo library gets the extension its declared type calls for.
 */
export function exportFileName(suggested: unknown, contentType?: string): string {
  // A leading dot hides the file, and MediaStore refuses a hidden name outright.
  const bare = bareFileName(suggested).replace(/^\.+/, '')
  const name = bare === '' ? FALLBACK_NAME : bare

  const dot = name.lastIndexOf('.')
  const splits = dot > 0 && utf8Encode(name.slice(dot + 1)).length <= MAX_EXTENSION_BYTES
  const [stem, extension] = splits ? [name.slice(0, dot), name.slice(dot + 1)] : [name, '']
  const forced = photoLibraryExtension(contentType)
  return capped(stem, forced ?? extension)
}

/** Only the characters a staging token is made of, so a token can never be a path of its own. */
const TOKEN = /^[0-9a-f-]{8,64}$/i

/** Where one export is written before it is handed on: a folder of its own under `root`. */
export function stagedPath(root: string, token: string, name: string): string {
  if (!TOKEN.test(token)) throw new Error('not a staging token')
  return `${root}/${token}/${name}`
}

/**
 * The staging token a path was written under, or null when it is not one this run handed out.
 *
 * By folder rather than by the exact path handed out, because libsession answers a collision
 * with `name (1)`. The name part must still be a single plain segment, and the folder a token
 * that is still pending.
 */
export function stagingTokenOf(
  path: unknown,
  root: string,
  pending: { has(token: string): boolean },
): string | null {
  if (typeof path !== 'string' || !path.startsWith(`${root}/`)) return null
  const rest = path.slice(root.length + 1).split('/')
  if (rest.length !== 2) return null
  const [token, name] = rest as [string, string]
  if (!TOKEN.test(token) || !pending.has(token)) return null
  if (name === '' || name === '.' || name === '..' || name.includes('\\')) return null
  return token
}

/**
 * `name (1).ext`, `name (2).ext`... the first that is not taken, as libsession names a collision.
 *
 * A picked folder refuses a copy onto a name it already holds, and overwriting somebody's file
 * with an attachment is not the answer.
 */
export function unusedName(name: string, taken: ReadonlySet<string>): string {
  if (!taken.has(name)) return name
  const dot = name.lastIndexOf('.')
  const [stem, extension] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, '']
  for (let n = 1; ; n += 1) {
    const candidate = `${stem} (${String(n)})${extension}`
    if (!taken.has(candidate)) return candidate
  }
}

/**
 * Whether a remembered folder is a document tree the Storage Access Framework granted.
 *
 * Read back from a file only this app writes, and checked anyway: attachments get written wherever
 * this points, so nothing but a tree somebody picked may stand in for one.
 */
export function isGrantedFolderUri(uri: unknown): uri is string {
  return typeof uri === 'string' && /^content:\/\/[\w.-]+\/tree\/\S+$/.test(uri)
}

/**
 * The folder a granted document tree stands for, as a document URI a file manager opens.
 *
 * A tree URI names the grant, `.../tree/<id>`, and a view intent wants the document,
 * `.../document/<id>`; the id is the same. Null for anything that is not a granted tree.
 */
export function folderDocumentUri(treeUri: string): string | null {
  if (!isGrantedFolderUri(treeUri)) return null
  const match = /^(content:\/\/[\w.-]+)\/tree\/([^/]+)/.exec(treeUri)
  return match === null ? null : `${match[1] ?? ''}/document/${match[2] ?? ''}`
}
