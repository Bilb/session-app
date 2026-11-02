import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { encodePng, type Picture } from '#catalog/diff'
import { writeReport } from '#catalog/writeReport'

function solid(width: number, height: number, grey: number): Picture {
  const data = new Uint8Array(width * height * 4).fill(grey)
  for (let at = 3; at < data.length; at += 4) data[at] = 255
  return { width, height, data }
}

function captures(dir: string, pages: Record<string, Picture>): string {
  mkdirSync(dir, { recursive: true })
  for (const [id, picture] of Object.entries(pages))
    writeFileSync(join(dir, `${id}.png`), encodePng(picture))
  return dir
}

describe('writing the report from two folders of captures', () => {
  const root = mkdtempSync(join(tmpdir(), 'catalog-report-'))
  const beforeDir = captures(join(root, 'before-pages'), {
    same: solid(40, 30, 255),
    darker: solid(40, 30, 255),
    taller: solid(40, 30, 255),
    gone: solid(40, 30, 0),
  })
  const afterDir = captures(join(root, 'after-pages'), {
    same: solid(40, 30, 255),
    darker: solid(40, 30, 0),
    taller: solid(40, 60, 255),
    new: solid(40, 30, 0),
  })
  const reportDir = join(root, 'report')
  const { results, file } = writeReport({
    beforeDir,
    afterDir,
    reportDir,
    base: { label: 'base', sha: 'a'.repeat(40) },
    head: { label: 'working tree', sha: 'b'.repeat(40) },
    tier: 'pr',
    sensitivity: 0.5,
    warnings: [],
  })

  it('classifies every page either side drew', () => {
    expect(results.map(({ id, status }) => `${id} ${status}`)).toEqual([
      'darker changed',
      'taller changed',
      'new added',
      'gone removed',
      'same unchanged',
    ])
    expect(results.find((result) => result.id === 'darker')?.differingPixels).toBe(1200)
  })

  it('puts each picture the report shows beside it, and a diff only for what changed', () => {
    const has = (path: string) => existsSync(join(reportDir, path))
    expect(['before/darker.png', 'after/darker.png', 'diff/darker.png'].every(has)).toBe(true)
    expect(has('diff/taller.png')).toBe(true)
    expect(has('after/new.png') && !has('before/new.png')).toBe(true)
    expect(has('before/gone.png') && !has('after/gone.png')).toBe(true)
    expect(has('diff/same.png')).toBe(false)
    expect(readFileSync(file, 'utf8')).toContain('src="diff/darker.png"')
  })
})
