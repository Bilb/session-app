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
    staging.add([picked('photo.jpg', 'session-media://picked/new')])
    expect(released).toEqual(['session-media://picked/old'])
    expect(discarded).toEqual([])
    expect(staging.handOff().map((file) => file.previewUrl)).toEqual(['session-media://picked/new'])
  })
})
