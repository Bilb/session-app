import {
  ExportAccessRefused,
  memoryPorts,
  resetPorts,
  setPorts,
  type FilesPort,
} from '@session/app'
import type { Attachment, AttachmentRef, Message } from '@session/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { exportOne } from '#src/exportAttachment'

function attachment(index: number, fields: Partial<Attachment> = {}): Attachment {
  return {
    index,
    contentType: 'application/pdf',
    filename: 'itinerary.pdf',
    voiceMessage: false,
    hasPreview: false,
    uploaded: true,
    availability: 'cached',
    fetchDoneBytes: 0,
    fetchTotalBytes: 0,
    ...fields,
  }
}

function message(attachments: Attachment[]): Message {
  return { id: 7, attachments } as unknown as Message
}

function installFiles(files: Partial<FilesPort>): FilesPort {
  const ports = memoryPorts()
  const installed = { ...ports.files, ...files }
  setPorts({ ...ports, files: installed })
  return installed
}

afterEach(() => {
  resetPorts()
})

describe('exporting one attachment', () => {
  it('asks where with the sender name and type, writes there, then shows where it landed', async () => {
    const choose = vi.fn(() => Promise.resolve('/chosen/itinerary.pdf'))
    const reveal = vi.fn(() => Promise.resolve())
    installFiles({ chooseExportLocation: choose, revealInFolder: reveal })
    const write = vi.fn((_ref: AttachmentRef, destination: string) =>
      Promise.resolve(destination.replace('.pdf', ' (1).pdf')),
    )

    await exportOne(message([attachment(0)]), 0, { exportAttachment: write }, vi.fn())

    expect(choose).toHaveBeenCalledWith('itinerary.pdf', 'application/pdf')
    expect(write).toHaveBeenCalledWith({ messageId: 7, index: 0 }, '/chosen/itinerary.pdf')
    // Where libsession says it landed, not where it was asked to go: a collision renames it.
    expect(reveal).toHaveBeenCalledWith('/chosen/itinerary (1).pdf')
  })

  it('exports the attachment at that index, not the first one', async () => {
    const choose = vi.fn(() => Promise.resolve('/chosen/b.jpg'))
    installFiles({ chooseExportLocation: choose })
    const write = vi.fn(() => Promise.resolve('/chosen/b.jpg'))
    const set = [
      attachment(0, { filename: 'a.pdf' }),
      attachment(1, { filename: 'b.jpg', contentType: 'image/jpeg' }),
    ]

    await exportOne(message(set), 1, { exportAttachment: write }, vi.fn())

    expect(choose).toHaveBeenCalledWith('b.jpg', 'image/jpeg')
    expect(write).toHaveBeenCalledWith({ messageId: 7, index: 1 }, '/chosen/b.jpg')
  })

  it('names a nameless attachment by its position', async () => {
    const choose = vi.fn(() => Promise.resolve(null))
    installFiles({ chooseExportLocation: choose })
    const nameless = attachment(1)
    delete nameless.filename

    await exportOne(message([attachment(0), nameless]), 1, { exportAttachment: vi.fn() }, vi.fn())

    expect(choose).toHaveBeenCalledWith('attachment-2', 'application/pdf')
  })

  it('writes nothing when the person cancels', async () => {
    const reveal = vi.fn(() => Promise.resolve())
    installFiles({ chooseExportLocation: () => Promise.resolve(null), revealInFolder: reveal })
    const write = vi.fn()

    await exportOne(message([attachment(0)]), 0, { exportAttachment: write }, vi.fn())

    expect(write).not.toHaveBeenCalled()
    expect(reveal).not.toHaveBeenCalled()
  })

  it('reveals nothing and throws nothing when the write fails', async () => {
    const reveal = vi.fn(() => Promise.resolve())
    installFiles({
      chooseExportLocation: () => Promise.resolve('/chosen/x'),
      revealInFolder: reveal,
    })

    await expect(
      exportOne(
        message([attachment(0)]),
        0,
        { exportAttachment: () => Promise.reject(new Error('not a chosen folder')) },
        vi.fn(),
      ),
    ).resolves.toBeUndefined()
    expect(reveal).not.toHaveBeenCalled()
  })

  it('throws nothing when handing the file on fails', async () => {
    installFiles({
      chooseExportLocation: () => Promise.resolve('/chosen/x'),
      revealInFolder: () => Promise.reject(new Error('photo library refused it')),
    })

    await expect(
      exportOne(
        message([attachment(0)]),
        0,
        { exportAttachment: () => Promise.resolve('/chosen/x') },
        vi.fn(),
      ),
    ).resolves.toBeUndefined()
  })

  it('explains a refused access the OS will not ask for again, and writes nothing', async () => {
    installFiles({
      chooseExportLocation: () => Promise.reject(new ExportAccessRefused('storage')),
    })
    const write = vi.fn()
    const explain = vi.fn()

    await exportOne(message([attachment(0)]), 0, { exportAttachment: write }, explain)

    expect(write).not.toHaveBeenCalled()
    expect(explain).toHaveBeenCalledWith('storage')
  })

  it('explains nothing for any other failure', async () => {
    installFiles({ chooseExportLocation: () => Promise.reject(new Error('picker crashed')) })
    const explain = vi.fn()

    await exportOne(message([attachment(0)]), 0, { exportAttachment: vi.fn() }, explain)

    expect(explain).not.toHaveBeenCalled()
  })
})
