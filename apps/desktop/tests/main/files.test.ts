import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import { MAX_SUGGESTED_NAME_CHARS } from '@session/app/exportFileName'
import type { Frame, Request } from '@session/client'

import type { BrowserWindow } from 'electron'

import {
  dialogDefaultPath,
  ExportGate,
  MAX_PATH_CHARS,
  readLastFolder,
  sanitiseSuggestedName,
  SendGate,
  serveFiles,
  writeLastFolder,
} from '#src/main/files'
import { PreviewGrants } from '#src/main/previewGrants'

vi.mock('electron', () => ({
  default: { app: { getPath: () => tmpdir() }, dialog: {}, shell: {} },
}))

function exportTo(destination: string, id = 1, replace = false): Request {
  return {
    id,
    command: {
      type: 'exportAttachment',
      messageId: 7,
      index: 0,
      destination,
      notifySender: false,
      replace,
    },
  }
}

function landed(id: number, path: string): Frame {
  return { type: 'response', response: { id, result: { type: 'path', path } } }
}

/**
 * What the renderer is allowed to have written, and shown.
 *
 * `save_attachment` writes wherever it is told and `showItemInFolder` acts on any path, and the
 * page is not trusted to have checked either - the same standard `open-external` holds itself to.
 */
describe('an export the page asks for', () => {
  const chosen = '/home/someone/Documents/itinerary.pdf'

  it('goes to the exact path a save dialog returned', () => {
    const gate = new ExportGate(false)
    gate.grant(chosen, false)
    expect(gate.admit(exportTo(chosen))).toEqual(exportTo(chosen))
  })

  it('is refused before anything has been chosen', () => {
    const gate = new ExportGate(false)
    expect(typeof gate.admit(exportTo(chosen))).toBe('string')
    expect(typeof gate.admit(exportTo('/etc/passwd'))).toBe('string')
  })

  it('is refused under another name in the folder that was chosen', () => {
    // A folder rule would let this through: one answer would be a licence for any name there.
    const gate = new ExportGate(false)
    gate.grant(chosen, false)
    expect(typeof gate.admit(exportTo('/home/someone/Documents/.bashrc'))).toBe('string')
    expect(typeof gate.admit(exportTo('/home/someone/Documents/../.ssh/authorized_keys'))).toBe(
      'string',
    )
  })

  it('spends its grant: a second export to the same path is refused', () => {
    const gate = new ExportGate(false)
    gate.grant(chosen, false)
    expect(typeof gate.admit(exportTo(chosen, 1))).not.toBe('string')
    expect(typeof gate.admit(exportTo(chosen, 2))).toBe('string')
  })

  it('overwrites only where the dialog was answered over an existing file', () => {
    // The page's own `replace` is ignored either way: it is the dialog's question, not the page's.
    const fresh = new ExportGate(false)
    fresh.grant(chosen, false)
    expect(fresh.admit(exportTo(chosen, 1, true))).toEqual(exportTo(chosen, 1, false))

    const existing = new ExportGate(false)
    existing.grant(chosen, true)
    expect(existing.admit(exportTo(chosen, 1, false))).toEqual(exportTo(chosen, 1, true))
  })

  it('is resolved and compared by case only where paths are case-insensitive', () => {
    const insensitive = new ExportGate(true)
    insensitive.grant(chosen, false)
    expect(typeof insensitive.admit(exportTo('/home/someone/documents/ITINERARY.pdf'))).not.toBe(
      'string',
    )

    const sensitive = new ExportGate(false)
    sensitive.grant(chosen, false)
    expect(typeof sensitive.admit(exportTo('/home/someone/documents/itinerary.pdf'))).toBe('string')
    sensitive.grant(chosen, false)
    expect(
      typeof sensitive.admit(exportTo('/home/someone/Documents/../Documents/itinerary.pdf')),
    ).not.toBe('string')
  })

  it('follows a symlink to compare by the real folder, not by name', () => {
    const root = mkdtempSync(join(tmpdir(), 'session-app-files-test-'))
    const real = join(root, 'real')
    mkdirSync(real)
    const alias = join(root, 'alias')
    symlinkSync(real, alias)

    const gate = new ExportGate(false)
    gate.grant(join(alias, 'x.pdf'), false)
    expect(typeof gate.admit(exportTo(join(real, 'x.pdf')))).not.toBe('string')
  })

  it('is refused when it is longer than any real path', () => {
    const folder = '/home/someone/Documents/'
    const longest = folder + 'x'.repeat(MAX_PATH_CHARS - folder.length)
    const gate = new ExportGate(false)
    gate.grant(longest, false)
    gate.grant(longest + 'x', false)
    expect(typeof gate.admit(exportTo(longest, 1))).not.toBe('string')
    expect(typeof gate.admit(exportTo(longest + 'x', 2))).toBe('string')
  })

  it('passes every other command through untouched', () => {
    const gate = new ExportGate(false)
    const other: Request = { id: 3, command: { type: 'getAccountInfo' } }
    expect(gate.admit(other)).toBe(other)
  })
})

describe('a path the page asks to reveal', () => {
  const chosen = '/home/someone/Documents/itinerary.pdf'

  it('is allowed where an admitted export reported landing, collision name included', () => {
    const gate = new ExportGate(false)
    gate.grant(chosen, false)
    gate.admit(exportTo(chosen, 5))
    gate.observe(landed(5, '/home/someone/Documents/itinerary (1).pdf'))
    expect(gate.mayReveal('/home/someone/Documents/itinerary (1).pdf')).toBe(true)
  })

  it('is refused anywhere else, the chosen folder and its parent included', () => {
    const gate = new ExportGate(false)
    gate.grant(chosen, false)
    gate.admit(exportTo(chosen, 5))
    gate.observe(landed(5, chosen))
    expect(gate.mayReveal('/home/someone/Documents/..')).toBe(false)
    expect(gate.mayReveal('/home/someone/Documents/other.pdf')).toBe(false)
    expect(gate.mayReveal('/etc/passwd')).toBe(false)
  })

  it('is refused for a path answered to a request the gate did not admit', () => {
    const gate = new ExportGate(false)
    gate.observe(landed(9, '/home/someone/.ssh/id_ed25519'))
    expect(gate.mayReveal('/home/someone/.ssh/id_ed25519')).toBe(false)
  })

  it('is refused when it is not a path at all', () => {
    const gate = new ExportGate(false)
    for (const nonsense of ['', null, undefined, 42, {}]) {
      expect(gate.mayReveal(nonsense)).toBe(false)
    }
  })
})

describe('the name a save dialog is pre-filled with', () => {
  it('keeps an ordinary name as it is', () => {
    expect(sanitiseSuggestedName('itinerary (final).pdf')).toBe('itinerary (final).pdf')
  })

  it('is the bare name, as every platform starts from', () => {
    expect(sanitiseSuggestedName('../../.ssh/authorized_keys')).toBe('authorized_keys')
    expect(sanitiseSuggestedName('invoice\u202efdp.exe')).toBe('invoicefdp.exe')
  })

  it('falls back rather than trimming a name longer than a filesystem allows', () => {
    const longest = 'x'.repeat(MAX_SUGGESTED_NAME_CHARS)
    expect(sanitiseSuggestedName(longest)).toBe(longest)
    expect(sanitiseSuggestedName(longest + 'x')).toBe('attachment')
  })

  it('falls back when nothing usable is left', () => {
    for (const nothing of ['', '   ', '.', '..', '../..', 'folder/', '\u0000\u0001', null, 42]) {
      expect(sanitiseSuggestedName(nothing)).toBe('attachment')
    }
  })
})

describe('where a save dialog opens', () => {
  it('leaves the folder to macOS and Windows, which remember it themselves', () => {
    expect(dialogDefaultPath('a.jpg', 'darwin', '/last', '/downloads')).toBe('a.jpg')
    expect(dialogDefaultPath('a.jpg', 'win32', '/last', '/downloads')).toBe('a.jpg')
  })

  it('opens on Linux where the last export went, else in Downloads', () => {
    expect(dialogDefaultPath('a.jpg', 'linux', '/last', '/downloads')).toBe(join('/last', 'a.jpg'))
    expect(dialogDefaultPath('a.jpg', 'linux', undefined, '/downloads')).toBe(
      join('/downloads', 'a.jpg'),
    )
  })

  it('remembers the last folder across runs', () => {
    const dir = mkdtempSync(join(tmpdir(), 'last-folder-'))
    const file = join(dir, 'last-export-folder')
    expect(readLastFolder(file)).toBeUndefined()
    writeLastFolder(file, dir)
    expect(readLastFolder(file)).toBe(dir)
  })

  it('forgets a folder that is gone, or is not a folder', () => {
    const dir = mkdtempSync(join(tmpdir(), 'last-folder-'))
    const file = join(dir, 'last-export-folder')
    const gone = join(dir, 'gone')
    mkdirSync(gone)
    writeLastFolder(file, gone)
    rmSync(gone, { recursive: true })
    expect(readLastFolder(file)).toBeUndefined()

    writeLastFolder(file, file)
    expect(readLastFolder(file)).toBeUndefined()

    writeFileSync(file, '')
    expect(readLastFolder(file)).toBeUndefined()
  })
})

function sending(attachments: unknown, id = 1): Request {
  return {
    id,
    command: {
      type: 'sendMessage',
      conversationId: '05' + 'ab'.repeat(32),
      body: '',
      attachments: attachments as never,
    },
  }
}

/** libsession reads whatever a send names, so the page may name only what the person picked. */
describe('a send the page asks for', () => {
  const photo = '/home/someone/Pictures/harbour.jpg'

  it('carries a file picked in this window, as it was described', () => {
    const gate = new SendGate(false)
    gate.grant(photo)
    const asked = sending([{ path: photo, contentType: 'image/jpeg', filename: 'harbour.jpg' }])
    expect(gate.admit(asked)).toEqual(asked)
  })

  it('is refused for a file nobody picked', () => {
    const gate = new SendGate(false)
    gate.grant(photo)
    expect(
      typeof gate.admit(sending([{ path: photo }, { path: '/home/someone/.ssh/id_ed25519' }])),
    ).toBe('string')
    expect(typeof gate.admit(sending([{}]))).toBe('string')
    expect(typeof gate.admit(sending([null]))).toBe('string')
    expect(typeof gate.admit(sending('/etc/passwd'))).toBe('string')
  })

  it('never lets libsession take the person’s own file', () => {
    const gate = new SendGate(false)
    gate.grant(photo)
    expect(gate.admit(sending([{ path: photo, takeFile: true }]))).toEqual(
      sending([{ path: photo }]),
    )
  })

  it('holds a grant until every pick of the path has been let go', () => {
    const gate = new SendGate(false)
    gate.grant(photo)
    gate.grant(photo)
    gate.release(photo)
    expect(typeof gate.admit(sending([{ path: photo }]))).not.toBe('string')
    gate.release(photo)
    expect(typeof gate.admit(sending([{ path: photo }]))).toBe('string')
  })

  it('folds case where the file system does', () => {
    const gate = new SendGate(true)
    gate.grant('C:\\Users\\Someone\\Photo.JPG')
    expect(typeof gate.admit(sending([{ path: 'c:\\users\\someone\\photo.jpg' }]))).not.toBe(
      'string',
    )
  })

  it('plans a send only of a file picked in this window, and while it is held', () => {
    const plan = (path: unknown): Request => ({
      id: 3,
      command: { type: 'attachmentSendPlan', path } as Request['command'],
    })
    const gate = new SendGate(false)
    expect(typeof gate.admit(plan(photo))).toBe('string')
    gate.grant(photo)
    expect(gate.admit(plan(photo))).toEqual(plan(photo))
    expect(typeof gate.admit(plan('/home/someone/.ssh/id_ed25519'))).toBe('string')
    expect(typeof gate.admit(plan(undefined))).toBe('string')
    expect(typeof gate.admit(plan(42))).toBe('string')
    gate.release(photo)
    expect(typeof gate.admit(plan(photo))).toBe('string')
  })

  it('sends and plans the file it admitted, as the grant resolved it', () => {
    const root = mkdtempSync(join(tmpdir(), 'session-app-files-test-'))
    try {
      const real = join(root, 'real')
      mkdirSync(real)
      const alias = join(root, 'alias')
      symlinkSync(real, alias)
      const gate = new SendGate(false)
      gate.grant(join(alias, 'harbour.jpg'))
      const admitted = join(realpathSync(real), 'harbour.jpg')
      const spelled = join(alias, '..', 'alias', 'harbour.jpg')

      expect(
        gate.admit(sending([{ path: spelled, contentType: 'image/jpeg', filename: 'h.jpg' }])),
      ).toEqual(sending([{ path: admitted, contentType: 'image/jpeg', filename: 'h.jpg' }]))
      const plan = (path: string): Request => ({
        id: 3,
        command: { type: 'attachmentSendPlan', path },
      })
      expect(gate.admit(plan(spelled))).toEqual(plan(admitted))
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('keeps the case of the path it sends where it folds case to compare', () => {
    const gate = new SendGate(true)
    gate.grant('/home/Someone/Photo.JPG')
    expect(gate.admit(sending([{ path: '/home/someone/photo.jpg' }]))).toEqual(
      sending([{ path: '/home/someone/photo.jpg' }]),
    )
  })

  it('leaves a message without files, and every other command, alone', () => {
    const gate = new SendGate(false)
    const plain: Request = {
      id: 2,
      command: { type: 'sendMessage', conversationId: '05' + 'ab'.repeat(32), body: 'hi' },
    }
    expect(gate.admit(plain)).toBe(plain)
    expect(gate.admit(exportTo('/tmp/x'))).toEqual(exportTo('/tmp/x'))
  })
})

const APP_URL = 'app://session/index.html'

/** A window as `serveFiles` uses it: its handlers and listeners, callable from the test. */
function fakeWindow() {
  const handlers = new Map<string, (event: unknown, ...args: unknown[]) => unknown>()
  const listeners = new Map<string, () => void>()
  const window = {
    webContents: {
      ipc: {
        handle: (channel: string, handler: (event: unknown, ...args: unknown[]) => unknown) => {
          handlers.set(channel, handler)
        },
      },
      on: (name: string, listener: () => void) => {
        listeners.set(name, listener)
      },
    },
  }
  const fromApp = { senderFrame: { url: APP_URL, parent: null } }
  return {
    window: window as unknown as BrowserWindow,
    invoke: (channel: string, ...args: unknown[]) => handlers.get(channel)?.(fromApp, ...args),
    emit: (name: string) => {
      listeners.get(name)?.()
    },
  }
}

describe('the gate a window serves its sends through', () => {
  const photo = '/home/someone/Pictures/harbour.jpg'

  it('admits only what this window picked and still holds', () => {
    const { window, invoke } = fakeWindow()
    const gate = serveFiles(window, APP_URL, new PreviewGrants())
    expect(typeof gate.admit(sending([{ path: photo }]))).toBe('string')
    expect(invoke('files:allow-send', photo)).toBe(true)
    expect(typeof gate.admit(sending([{ path: photo }]))).not.toBe('string')
    invoke('files:release-send', photo)
    expect(typeof gate.admit(sending([{ path: photo }]))).toBe('string')
  })

  it.each(['did-navigate', 'render-process-gone'])('forgets every pick on %s', (name) => {
    const { window, invoke, emit } = fakeWindow()
    const gate = serveFiles(window, APP_URL, new PreviewGrants())
    invoke('files:allow-send', photo)
    emit(name)
    expect(typeof gate.admit(sending([{ path: photo }]))).toBe('string')
  })
})
