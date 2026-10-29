import { afterEach, describe, expect, it, vi } from 'vitest'

import { toPickedFiles } from '#src/renderer/pickedFiles'

/** The preload as `toPickedFiles` uses it, keeping count of the send grants it holds. */
function stubPreload({ previewFails }: { previewFails: string }) {
  const granted = new Map<string, number>()
  const revoked: string[] = []
  vi.stubGlobal('window', {
    sessionDesktop: {
      pathForFile: (file: File) => `/picked/${file.name}`,
      allowSend: (file: File) => {
        const path = `/picked/${file.name}`
        granted.set(path, (granted.get(path) ?? 0) + 1)
        return Promise.resolve(true)
      },
      releaseSend: (path: string) => {
        granted.set(path, (granted.get(path) ?? 0) - 1)
        return Promise.resolve()
      },
      allowPreview: (file: File) =>
        file.name === previewFails
          ? Promise.reject(new Error('allowPreview'))
          : Promise.resolve(`session-media://picked/${file.name}`),
      revokePreview: (url: string) => {
        revoked.push(url)
        return Promise.resolve()
      },
    },
  })
  return { granted, revoked }
}

function picture(name: string): File {
  return new File([new Uint8Array(4)], name, { type: 'image/jpeg' })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('a pick that fails partway', () => {
  it('lets go of every grant the rest of it was given', async () => {
    const { granted, revoked } = stubPreload({ previewFails: 'b.jpg' })
    await expect(
      toPickedFiles([picture('a.jpg'), picture('b.jpg'), picture('c.jpg')]),
    ).rejects.toThrow('allowPreview')
    expect([...granted.values()]).toEqual([0, 0, 0])
    expect(revoked.sort()).toEqual(['session-media://picked/a.jpg', 'session-media://picked/c.jpg'])
  })
})
