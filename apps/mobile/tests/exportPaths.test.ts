import { utf8Encode } from '@session/basic-types'
import { describe, expect, it } from 'vitest'

import {
  exportFileName,
  folderDocumentUri,
  isGrantedFolderUri,
  numberedName,
  photoLibraryExtension,
  placeUnderFreeName,
  stagedPath,
  stagingTokenOf,
} from '#src/exportPaths'

const ROOT = '/data/user/0/org.getsession.session2/cache/session-exports'
const TOKEN = '3f2c1b9a-7d4e-4c55-9f10-2a6b8e0d4c11'

/**
 * The sender names the file, and `save_attachment` writes wherever the path says. Everything here
 * is about that name never choosing the directory.
 */
describe('the name an export is written under', () => {
  it('keeps an ordinary name', () => {
    expect(exportFileName('itinerary.pdf')).toBe('itinerary.pdf')
  })

  it('is the bare name, as every platform starts from', () => {
    expect(exportFileName('../../files/session/mainnet/session.db')).toBe('session.db')
    expect(exportFileName('invoice\u202efdp.exe')).toBe('invoicefdp.exe')
  })

  it('falls back to a plain name when nothing usable is left', () => {
    for (const nothing of ['', '..', '.', '/', 'a/', '   ', '\u0000', null, undefined, 42]) {
      expect(exportFileName(nothing)).toBe('attachment')
    }
  })

  it('strips leading dots', () => {
    expect(exportFileName('.hidden.pdf')).toBe('hidden.pdf')
  })

  it('gives a picture for the photo library the extension its type calls for', () => {
    expect(exportFileName('holiday.exe', 'image/jpeg')).toBe('holiday.jpg')
    expect(exportFileName('clip', 'video/mp4; codecs=avc1')).toBe('clip.mp4')
    expect(exportFileName('report.pdf', 'application/pdf')).toBe('report.pdf')
  })

  it('is bounded in bytes, keeping its extension', () => {
    const long = `${'é'.repeat(300)}.pdf`
    const name = exportFileName(long)
    expect(utf8Encode(name).length).toBeLessThanOrEqual(200)
    expect(name.endsWith('.pdf')).toBe(true)
  })

  it('is bounded when the extension alone is longer than the bound', () => {
    for (const long of [`a.${'x'.repeat(300)}`, `report.${'é'.repeat(250)}`]) {
      expect(utf8Encode(exportFileName(long)).length).toBeLessThanOrEqual(200)
    }
    expect(exportFileName(`a.${'x'.repeat(300)}`, 'image/jpeg').endsWith('.jpg')).toBe(true)
  })
})

describe('which files go to the photo library', () => {
  it('takes the pictures and videos a library can file', () => {
    expect(photoLibraryExtension('image/png')).toBe('png')
    expect(photoLibraryExtension('Image/JPEG')).toBe('jpg')
    expect(photoLibraryExtension('video/quicktime')).toBe('mov')
  })

  it('sends everything else to a folder', () => {
    for (const type of [
      'application/pdf',
      'video/webm',
      'image/svg+xml',
      'audio/mpeg',
      undefined,
    ]) {
      expect(photoLibraryExtension(type)).toBeNull()
    }
  })
})

describe('a path handed to exportAttachment or back to the port', () => {
  const pending = new Set([TOKEN])

  it('is accepted in a staging folder still pending, under the name a collision produced too', () => {
    const path = stagedPath(ROOT, TOKEN, 'itinerary.pdf')
    expect(stagingTokenOf(path, ROOT, pending)).toBe(TOKEN)
    expect(stagingTokenOf(`${ROOT}/${TOKEN}/itinerary (1).pdf`, ROOT, pending)).toBe(TOKEN)
  })

  it('is refused once delivered, or in a folder this run never made', () => {
    expect(stagingTokenOf(stagedPath(ROOT, TOKEN, 'x.pdf'), ROOT, new Set())).toBeNull()
    const other = '0badc0de-0000-4000-8000-000000000000'
    expect(stagingTokenOf(`${ROOT}/${other}/x.pdf`, ROOT, pending)).toBeNull()
  })

  it('is refused outside the staging root', () => {
    expect(
      stagingTokenOf('/data/user/0/org.getsession.session2/files/session.db', ROOT, pending),
    ).toBeNull()
    expect(stagingTokenOf(`${ROOT}-old/${TOKEN}/x.pdf`, ROOT, pending)).toBeNull()
    expect(stagingTokenOf(`${ROOT}/x.pdf`, ROOT, pending)).toBeNull()
  })

  it('is refused when it climbs or nests', () => {
    expect(stagingTokenOf(`${ROOT}/${TOKEN}/../../files/session.db`, ROOT, pending)).toBeNull()
    expect(stagingTokenOf(`${ROOT}/${TOKEN}/..`, ROOT, pending)).toBeNull()
    expect(stagingTokenOf(`${ROOT}/${TOKEN}/nested/x.pdf`, ROOT, pending)).toBeNull()
    expect(stagingTokenOf(`${ROOT}/${TOKEN}/`, ROOT, pending)).toBeNull()
  })

  it('is refused when it is not a path at all', () => {
    for (const nonsense of ['', null, undefined, 42, {}]) {
      expect(stagingTokenOf(nonsense, ROOT, pending)).toBeNull()
    }
  })

  it('never builds a staging path from a token that could be one', () => {
    expect(() => stagedPath(ROOT, '../files', 'x')).toThrow()
    expect(() => stagedPath(ROOT, '', 'x')).toThrow()
  })
})

describe('a name in a folder that already holds it', () => {
  it('is numbered the way libsession numbers a collision', () => {
    expect(numberedName('itinerary.pdf', 0)).toBe('itinerary.pdf')
    expect(numberedName('itinerary.pdf', 1)).toBe('itinerary (1).pdf')
    expect(numberedName('itinerary.pdf', 2)).toBe('itinerary (2).pdf')
    expect(numberedName('notes', 1)).toBe('notes (1)')
  })

  it('is found by attempting each name in turn, never by listing the folder', async () => {
    const held = new Set(['itinerary.pdf', 'itinerary (1).pdf'])
    const tried: string[] = []
    await placeUnderFreeName(
      'itinerary.pdf',
      (candidate) => {
        tried.push(candidate)
        if (held.has(candidate)) throw new Error('taken')
      },
      (error) => error instanceof Error && error.message === 'taken',
    )
    expect(tried).toEqual(['itinerary.pdf', 'itinerary (1).pdf', 'itinerary (2).pdf'])
  })

  it('passes any other failure straight through', async () => {
    const revoked = new Error('revoked')
    await expect(
      placeUnderFreeName(
        'x.pdf',
        () => {
          throw revoked
        },
        () => false,
      ),
    ).rejects.toBe(revoked)
  })

  it('gives up after a thousand collisions', async () => {
    let tries = 0
    await expect(
      placeUnderFreeName(
        'x.pdf',
        () => {
          tries += 1
          throw new Error('taken')
        },
        () => true,
      ),
    ).rejects.toThrow('taken')
    expect(tries).toBe(1001)
  })
})

describe('a remembered export folder', () => {
  it('is accepted only as a granted document tree', () => {
    expect(
      isGrantedFolderUri('content://com.android.externalstorage.documents/tree/primary%3ADownload'),
    ).toBe(true)
    for (const other of [
      'file:///data/user/0/org.getsession.session2/files',
      '/sdcard/Download',
      'content://com.android.externalstorage.documents/document/primary%3ADownload',
      'content://evil/tree/x y',
      '',
      null,
    ]) {
      expect(isGrantedFolderUri(other)).toBe(false)
    }
  })
})

describe('the folder an export is revealed in', () => {
  it('is the document the granted tree stands for', () => {
    expect(
      folderDocumentUri('content://com.android.externalstorage.documents/tree/primary%3ADocuments'),
    ).toBe('content://com.android.externalstorage.documents/document/primary%3ADocuments')
    expect(
      folderDocumentUri(
        'content://com.android.externalstorage.documents/tree/primary%3ADocuments%2FSession',
      ),
    ).toBe('content://com.android.externalstorage.documents/document/primary%3ADocuments%2FSession')
  })

  it('is nothing for what is not a granted tree', () => {
    expect(folderDocumentUri('file:///data/user/0/org.getsession.session2/files')).toBeNull()
    expect(
      folderDocumentUri('content://com.android.externalstorage.documents/document/x'),
    ).toBeNull()
  })
})
