import type { PickedFile } from '@session/app'
import { MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS_PER_MESSAGE } from '@session/basic-types'
import { describe, expect, it } from 'vitest'

import { isFull, letGo, stage as stageWith, unstage } from '#src/staging'

const DESKTOP = { picksAreCopies: false }
const MOBILE = { picksAreCopies: true }
const stage = (staged: PickedFile[], picked: PickedFile[]) => stageWith(staged, picked, DESKTOP)

function file(name: string, size?: number): PickedFile {
  return { path: `/picked/${name}`, name, ...(size === undefined ? {} : { size }) }
}

function files(count: number, prefix = 'f'): PickedFile[] {
  return Array.from({ length: count }, (_, i) => file(`${prefix}${String(i)}.jpg`, 1000))
}

describe('staging attachments', () => {
  it('appends in the order picked, mixing any types', () => {
    const { files: staged, refused } = stage(
      [file('a.jpg', 10)],
      [file('b.pdf', 10), file('c.mp4', 10), file('d.m4a', 10)],
    )
    expect(staged.map((f) => f.name)).toEqual(['a.jpg', 'b.pdf', 'c.mp4', 'd.m4a'])
    expect(refused).toEqual({ tooLarge: [], overLimit: 0, unreadable: 0 })
  })

  it('refuses a file over the file server limit and keeps the rest', () => {
    const big = file('drone.mov', MAX_ATTACHMENT_BYTES + 1)
    const { files: staged, refused } = stage([], [file('a.jpg', 10), big, file('b.jpg', 10)])
    expect(staged.map((f) => f.name)).toEqual(['a.jpg', 'b.jpg'])
    expect(refused.tooLarge).toEqual([big])
  })

  it('measures a file by what it uploads as, which padding takes over the limit first', () => {
    expect(stage([], [file('fits.bin', 9_956_278)]).files).toHaveLength(1)
    expect(stage([], [file('pads-over.bin', 9_956_279)]).refused.tooLarge).toHaveLength(1)
    expect(
      stage([], [file('exactly-10mb.bin', MAX_ATTACHMENT_BYTES)]).refused.tooLarge,
    ).toHaveLength(1)
  })

  it('lets through a file whose size the platform did not report', () => {
    expect(stage([], [file('unknown.bin')]).files).toHaveLength(1)
  })

  it('stops at the per-message limit and counts what it left out', () => {
    const { files: staged, refused } = stage(files(30), files(5, 'g'))
    expect(staged).toHaveLength(MAX_ATTACHMENTS_PER_MESSAGE)
    expect(staged.at(-1)?.name).toBe('g1.jpg')
    expect(refused.overLimit).toBe(3)
    expect(isFull(staged)).toBe(true)
  })

  it('does not count an oversized file against the limit', () => {
    const { files: staged, refused } = stage(files(31), [
      file('big.mov', MAX_ATTACHMENT_BYTES + 1),
      file('last.jpg', 10),
    ])
    expect(staged.at(-1)?.name).toBe('last.jpg')
    expect(refused).toMatchObject({ overLimit: 0 })
  })

  it('skips a file already staged rather than refusing it, and keeps its file', () => {
    const a = file('a.jpg', 10)
    const { files: staged, refused, unused } = stage([a], [a, file('b.jpg', 10)])
    expect(staged.map((f) => f.name)).toEqual(['a.jpg', 'b.jpg'])
    expect(refused).toEqual({ tooLarge: [], overLimit: 0, unreadable: 0 })
    // The same path is the staged file's own: handing it back to be deleted would delete that.
    expect(unused).toEqual([])
  })

  it('knows the same photo picked twice on mobile, where every pick is a fresh copy', () => {
    const first = { path: '/cache/ImagePicker/A.jpg', name: 'IMG_1.jpg', size: 2_000 }
    const again = { path: '/cache/ImagePicker/B.jpg', name: 'IMG_1.jpg', size: 2_000 }
    const { files: staged, unused } = stageWith([first], [again], MOBILE)
    expect(staged).toEqual([first])
    expect(unused).toEqual([again])
  })

  it('keeps two files of one name and size on desktop, where each is its own path', () => {
    const one = { ...file('scan.pdf', 500), path: '/home/a/scan.pdf' }
    const other = { ...file('scan.pdf', 500), path: '/home/b/scan.pdf' }
    expect(stage([one], [other]).files).toEqual([one, other])
  })

  it('hands back every pick it did not stage, so its copy can go', () => {
    const big = file('big.mov', MAX_ATTACHMENT_BYTES)
    const { unused } = stage(files(32), [big, file('extra.jpg', 10)])
    expect(unused.map((f) => f.name)).toEqual(['big.mov', 'extra.jpg'])
  })

  it('removes one file by its path', () => {
    const staged = stage([], [file('a.jpg', 1), file('b.jpg', 1)]).files
    expect(unstage(staged, '/picked/a.jpg').map((f) => f.name)).toEqual(['b.jpg'])
  })
})

describe('letting go of staged picks', () => {
  function port() {
    const released: string[] = []
    const discarded: string[] = []
    return {
      released,
      discarded,
      releasePreview: (f: PickedFile) => released.push(f.path),
      discardPicked: (f: PickedFile) => discarded.push(f.path),
    }
  }

  it('releases the preview and deletes the copy of a pick that will not be sent', () => {
    const p = port()
    letGo(p, [file('a.jpg'), file('b.jpg')], { sent: false })
    expect(p.released).toEqual(['/picked/a.jpg', '/picked/b.jpg'])
    expect(p.discarded).toEqual(['/picked/a.jpg', '/picked/b.jpg'])
  })

  it('releases the preview of a sent pick and keeps its file for the upload', () => {
    const p = port()
    letGo(p, [file('a.jpg')], { sent: true })
    expect(p.released).toEqual(['/picked/a.jpg'])
    expect(p.discarded).toEqual([])
  })
})
