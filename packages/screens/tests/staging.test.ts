import type { PickedFile } from '@session/app'
import { MAX_ATTACHMENTS_PER_MESSAGE } from '@session/basic-types'
import type { SendPlan } from '@session/client'
import { describe, expect, it } from 'vitest'

import {
  isFull,
  letGo,
  outgoingAttachment,
  recheck,
  stage as stageWith,
  unchangedRepick,
  unstage,
} from '#src/staging'

/** libsession's answer by name, `as-is` for a name it is not given; `big*` is over the limit. */
function planOf(plans: Record<string, SendPlan> = {}) {
  return (file: PickedFile): SendPlan =>
    plans[file.name] ?? (file.name.startsWith('big') ? 'too-large-for-server' : 'as-is')
}

const DESKTOP = { picksAreCopies: false, planOf: planOf() }
const MOBILE = { picksAreCopies: true, planOf: planOf() }
const stage = (staged: PickedFile[], picked: PickedFile[]) => stageWith(staged, picked, DESKTOP)
const NOTHING_REFUSED = {
  tooLarge: [],
  tooLargeToDecode: [],
  unopenable: [],
  overLimit: 0,
  unreadable: 0,
  sendRefused: 'none',
}

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
    expect(refused).toEqual(NOTHING_REFUSED)
  })

  it('refuses a file over the file server limit and keeps the rest', () => {
    const big = file('big-drone.mov', 20_000_000)
    const { files: staged, refused } = stage([], [file('a.jpg', 10), big, file('b.jpg', 10)])
    expect(staged.map((f) => f.name)).toEqual(['a.jpg', 'b.jpg'])
    expect(refused.tooLarge).toEqual([big])
  })

  it('files each refused plan under its own notice, and stages every other plan', () => {
    const plans: Record<string, SendPlan> = {
      'pano.jpg': 'too-large-to-decode',
      'broken.png': 'unreadable',
      'gone.pdf': 'missing',
      'photo.jpg': 'reencoded',
      'heic.heic': 'original-cannot-decode',
      'spin.png': 'original-animated-png',
    }
    const picked = Object.keys(plans).map((name) => file(name, 10))
    const {
      files: staged,
      refused,
      unused,
    } = stageWith([], picked, {
      ...DESKTOP,
      planOf: planOf(plans),
    })
    expect(staged.map((f) => f.name)).toEqual(['photo.jpg', 'heic.heic', 'spin.png'])
    expect(refused.tooLargeToDecode.map((f) => f.name)).toEqual(['pano.jpg'])
    expect(refused.unopenable.map((f) => f.name)).toEqual(['broken.png', 'gone.pdf'])
    expect(refused.tooLarge).toEqual([])
    expect(unused.map((f) => f.name)).toEqual(['pano.jpg', 'broken.png', 'gone.pdf'])
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
      file('big.mov', 20_000_000),
      file('last.jpg', 10),
    ])
    expect(staged.at(-1)?.name).toBe('last.jpg')
    expect(refused).toMatchObject({ overLimit: 0 })
  })

  it('skips a file already staged rather than refusing it, and keeps its file', () => {
    const a = file('a.jpg', 10)
    const { files: staged, refused, unused } = stage([a], [a, file('b.jpg', 10)])
    expect(staged.map((f) => f.name)).toEqual(['a.jpg', 'b.jpg'])
    expect(refused).toEqual(NOTHING_REFUSED)
    // The same path is the staged file's own: handing it back to be deleted would delete that.
    expect(unused).toEqual([])
  })

  it('draws a file picked again at its path as it is now, letting go of the old preview', () => {
    const before = { ...file('photo.jpg', 10), previewUrl: 'session-media://picked/old' }
    const edited = { ...file('photo.jpg', 12), previewUrl: 'session-media://picked/new' }
    const { files: staged, unused, replaced } = stage([before, file('b.jpg', 1)], [edited])
    expect(staged.map((f) => f.previewUrl ?? f.name)).toEqual([
      'session-media://picked/new',
      'b.jpg',
    ])
    expect(staged[0]?.size).toBe(12)
    expect(replaced).toEqual([before])
    // Its path is the staged file's: the old entry goes without its file.
    expect(unused).toEqual([])
  })

  it('refuses a file picked again at its path once it cannot be sent', () => {
    const before = { ...file('big-clip.mov', 10), previewUrl: 'session-media://picked/old' }
    const grown = { ...file('big-clip.mov', 20_000_000), previewUrl: 'session-media://picked/new' }
    const { files: staged, refused, unused, replaced } = stage([before, file('b.jpg', 1)], [grown])
    expect(staged.map((f) => f.name)).toEqual(['b.jpg'])
    expect(refused.tooLarge).toEqual([grown])
    expect(unused).toEqual([grown])
    expect(replaced).toEqual([before])
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
    const big = file('big.mov', 20_000_000)
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

describe('what a send hands libsession', () => {
  const pick = { ...file('1f3a-harbour.jpg', 10), name: 'harbour.jpg', contentType: 'image/jpeg' }

  it('names each file as it was picked, not as it is stored', () => {
    expect(outgoingAttachment(pick, DESKTOP)).toEqual({
      path: '/picked/1f3a-harbour.jpg',
      filename: 'harbour.jpg',
      contentType: 'image/jpeg',
    })
  })

  it('gives libsession a copy the app made, and never the person’s own file', () => {
    expect(outgoingAttachment(pick, MOBILE).takeFile).toBe(true)
    expect(outgoingAttachment(pick, DESKTOP)).not.toHaveProperty('takeFile')
  })
})

describe('a file picked again', () => {
  const REPORT_BYTES = 10
  const report = {
    path: '/home/a/report.pdf',
    name: 'report.pdf',
    size: REPORT_BYTES,
    modifiedMs: 1000,
  }
  const asOwn = { picksAreCopies: false }

  it('is unchanged at the same path, size and modification time', () => {
    expect(unchangedRepick([report], { ...report, previewUrl: 'x' }, asOwn)).toBe(true)
  })

  it('is changed once its size or modification time differs, or either is unknown', () => {
    expect(unchangedRepick([report], { ...report, modifiedMs: 2000 }, asOwn)).toBe(false)
    expect(unchangedRepick([report], { ...report, size: REPORT_BYTES + 1 }, asOwn)).toBe(false)
    expect(unchangedRepick([report], { ...report, modifiedMs: undefined }, asOwn)).toBe(false)
    expect(unchangedRepick([{ ...report, modifiedMs: undefined }], report, asOwn)).toBe(false)
  })

  it('is never unchanged where picks are copies, whose staged copy is the only one', () => {
    expect(unchangedRepick([report], report, { picksAreCopies: true })).toBe(false)
  })
})

describe('staged files asked again after a refused send', () => {
  const kept = { path: '/home/a/kept.jpg', name: 'kept.jpg' }
  const gone = { path: '/home/a/gone.pdf', name: 'gone.pdf' }
  const grown = { path: '/home/a/grown.mov', name: 'grown.mov' }

  it('names those their plan now refuses, by why, and keeps the rest', () => {
    const { refused, gone: dropped } = recheck([
      [kept, 'reencoded'],
      [gone, 'missing'],
      [grown, 'too-large-for-server'],
    ])
    expect(refused.unopenable).toEqual([gone])
    expect(refused.tooLarge).toEqual([grown])
    expect(dropped).toEqual([gone, grown])
  })
})
