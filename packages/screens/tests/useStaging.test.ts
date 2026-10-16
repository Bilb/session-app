import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { memoryPorts, resetPorts, setPorts, type PickedFile } from '@session/app'
import type * as React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useStaging } from '#src/useStaging'

/**
 * One render of a hook, without a renderer: its state writes are recorded rather than applied,
 * and its effects run on `mount` and clean up on `unmount`.
 */
const hook = vi.hoisted(() => ({
  writes: [] as unknown[],
  effects: [] as (() => void | (() => void))[],
  cleanups: [] as (() => void)[],
}))

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof React>()),
  useState: (initial: unknown) => [
    initial,
    (value: unknown) => {
      hook.writes.push(value)
    },
  ],
  useRef: (current: unknown) => ({ current }),
  useCallback: (callback: unknown) => callback,
  useEffect: (effect: () => void | (() => void)) => {
    hook.effects.push(effect)
  },
}))

function mount() {
  const staging = useStaging()
  for (const effect of hook.effects.splice(0)) {
    const cleanup = effect()
    if (cleanup !== undefined) hook.cleanups.push(cleanup)
  }
  return staging
}

function unmount(): void {
  for (const cleanup of hook.cleanups.splice(0)) cleanup()
}

const released: (string | undefined)[] = []
const discarded: string[] = []

function picked(name: string, previewUrl?: string): PickedFile {
  return { path: `/home/a/${name}`, name, previewUrl }
}

beforeEach(() => {
  const ports = memoryPorts()
  setPorts({
    ...ports,
    files: {
      ...ports.files,
      releasePreview: (file) => released.push(file.previewUrl),
      discardPicked: (file) => discarded.push(file.path),
    },
  })
})

afterEach(() => {
  unmount()
  resetPorts()
  hook.writes.length = 0
  released.length = 0
  discarded.length = 0
})

describe('the composer staging', () => {
  it('lets go of the preview a re-pick of a staged path replaced, keeping its file', () => {
    const staging = mount()
    staging.add([picked('photo.jpg', 'session-media://picked/old')])
    const repicked = picked('photo.jpg', 'session-media://picked/new')
    staging.add([repicked])
    expect(released).toEqual(['session-media://picked/old'])
    expect(discarded).toEqual([])
    staging.handOff([repicked])
    expect(released).toEqual(['session-media://picked/old', 'session-media://picked/new'])
    expect(discarded).toEqual([])
  })

  it('hands over only what a message was sent with, and keeps what was staged since', () => {
    const staging = mount()
    const a = picked('a.jpg')
    staging.add([a, picked('b.jpg')])
    staging.handOff([a])
    expect(hook.writes).toContainEqual([picked('b.jpg')])
    expect(discarded).toEqual([])
  })

  it('keeps a re-pick of a path whose earlier pick is being sent', () => {
    const staging = mount()
    const sent = picked('a.jpg', 'session-media://picked/sent')
    staging.add([sent])
    const again = picked('a.jpg', 'session-media://picked/again')
    staging.add([again])
    hook.writes.length = 0
    released.length = 0
    staging.handOff([sent])
    expect(hook.writes).toContainEqual([again])
    expect(released).toEqual([])
  })

  it('lets go of nothing twice when a send lands after the conversation closed', () => {
    const staging = mount()
    const a = picked('a.jpg', 'session-media://picked/a')
    staging.add([a])
    unmount()
    expect(released).toEqual(['session-media://picked/a'])
    hook.writes.length = 0
    staging.handOff([a])
    staging.refuseSend('files')
    expect(released).toEqual(['session-media://picked/a'])
    expect(hook.writes).toEqual([])
  })

  it('keeps a refused send staged and says so', () => {
    const staging = mount()
    staging.add([picked('a.jpg')])
    staging.refuseSend('files')
    expect(hook.writes).toContainEqual({
      tooLarge: [],
      overLimit: 0,
      unreadable: 0,
      sendRefused: 'files',
    })
    expect(discarded).toEqual([])
  })

  it('lets go of what a picker hands back after the conversation closed', () => {
    const staging = mount()
    unmount()
    staging.add([picked('late.jpg', 'session-media://picked/late')], 1)
    expect(hook.writes).toEqual([])
    expect(released).toEqual(['session-media://picked/late'])
    expect(discarded).toEqual(['/home/a/late.jpg'])
  })

  it('refuses a drop that fails as unreadable, as it does a picker that fails', async () => {
    const staging = mount()
    await staging.take(Promise.reject(new Error('allowPreview')), 3)
    await staging.take(Promise.reject(new Error('picker')))
    const refusals = hook.writes.filter((value) => typeof value === 'object')
    expect(refusals).toContainEqual({
      tooLarge: [],
      overLimit: 0,
      unreadable: 3,
      sendRefused: 'none',
    })
    expect(refusals).toContainEqual({
      tooLarge: [],
      overLimit: 0,
      unreadable: 1,
      sendRefused: 'none',
    })
  })

  it('counts what a drop could not hand back as unreadable', async () => {
    const staging = mount()
    await staging.take(Promise.resolve([picked('a.jpg')]), 3)
    expect(hook.writes).toContainEqual({
      tooLarge: [],
      overLimit: 0,
      unreadable: 2,
      sendRefused: 'none',
    })
  })

  it('is how both a pick and a drop are staged', () => {
    const source = (file: string) => readFileSync(join(import.meta.dirname, '../src', file), 'utf8')
    expect(source('Composer.tsx')).toContain('staging.take(chosen)')
    expect(source('ConversationScreen.tsx')).toContain(
      'staging.take(requirePorts().files.droppedFiles(items)',
    )
    for (const file of ['Composer.tsx', 'ConversationScreen.tsx'])
      expect(source(file)).not.toContain('staging.add(')
  })
})
