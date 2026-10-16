import { describe, expect, it } from 'vitest'

import { lastSegment } from '#src/pickedPaths'
import { fileUri, plainPath } from '#src/storage/layout'

describe('a picked file’s path', () => {
  it('is the URL with its scheme gone and its escapes undone', () => {
    expect(plainPath('file:///data/user/0/cache/ImagePicker/My%20Photo%20%231.jpg')).toBe(
      '/data/user/0/cache/ImagePicker/My Photo #1.jpg',
    )
  })

  it('goes back to the same URL', () => {
    const path = '/var/mobile/Caches/DocumentPicker/rapport 100% final.pdf'
    expect(plainPath(fileUri(path))).toBe(path)
  })

  it('names the file by its last segment when the picker gave no name', () => {
    expect(lastSegment('file:///tmp/ImagePicker/IMG%200001.jpeg')).toBe('IMG 0001.jpeg')
  })
})
