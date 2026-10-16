/** libsession's `infer_content_type`, for a file sent with no declared type. */
const BY_EXTENSION: Readonly<Record<string, string>> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  heic: 'image/heic',
  bmp: 'image/bmp',
  tiff: 'image/tiff',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  avi: 'video/x-msvideo',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  opus: 'audio/opus',
  flac: 'audio/flac',
  wav: 'audio/wav',
  pdf: 'application/pdf',
  txt: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
  html: 'text/html',
  json: 'application/json',
  xml: 'application/xml',
  zip: 'application/zip',
  gz: 'application/gzip',
  bz2: 'application/x-bzip2',
  xz: 'application/x-xz',
  '7z': 'application/x-7z-compressed',
  tar: 'application/x-tar',
}

export function inferContentType(name: string): string {
  const dot = name.lastIndexOf('.')
  // A leading dot names a hidden file, which `std::filesystem::path::extension` does not count.
  const extension = dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
  return BY_EXTENSION[extension] ?? 'application/octet-stream'
}
