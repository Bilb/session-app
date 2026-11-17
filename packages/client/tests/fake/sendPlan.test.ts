import { describe, expect, it } from 'vitest'

import { friends } from '#src/fake/fixtures'
import { fakeSendPlan } from '#src/fake/sendPlan'

const LARGEST_SENT_AS_IS = 9_956_278
const anywhere = { decodesHeic: false }
const apple = { decodesHeic: true }

describe('the fake’s send plan', () => {
  it('sends a file up to the largest the file server takes once padded, and refuses past it', () => {
    expect(fakeSendPlan('video/mp4', LARGEST_SENT_AS_IS, anywhere)).toBe('as-is')
    expect(fakeSendPlan('video/mp4', LARGEST_SENT_AS_IS + 1, anywhere)).toBe('too-large-for-server')
    expect(fakeSendPlan('application/octet-stream', 10_000_000, anywhere)).toBe(
      'too-large-for-server',
    )
  })

  it('lets a size it does not know through', () => {
    expect(fakeSendPlan('application/pdf', undefined, anywhere)).toBe('as-is')
  })

  it('re-encodes any size of a picture libsession decodes, compared by essence', () => {
    for (const contentType of [
      'image/jpeg',
      'image/JPG',
      'image/pjpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/avif',
      'image/jpeg; charset=binary',
      ' image/png ',
    ])
      expect(fakeSendPlan(contentType, 40_000_000, anywhere)).toBe('reencoded')
  })

  it('sends a picture it does not decode as the original file, within the limit', () => {
    for (const contentType of ['image/bmp', 'image/tiff', 'image/apng', 'image/svg+xml']) {
      expect(fakeSendPlan(contentType, 2_000, apple)).toBe('original-cannot-decode')
      expect(fakeSendPlan(contentType, LARGEST_SENT_AS_IS + 1, apple)).toBe('too-large-for-server')
    }
  })

  it('re-encodes a HEIC only where the platform decodes one', () => {
    for (const contentType of ['image/heic', 'image/heif']) {
      expect(fakeSendPlan(contentType, 40_000_000, apple)).toBe('reencoded')
      expect(fakeSendPlan(contentType, 2_000, anywhere)).toBe('original-cannot-decode')
    }
  })
})

describe('a send plan asked of the fake', () => {
  function alice() {
    const { world, clients } = friends(['Alice', 'Bob'])
    const client = clients['Alice']
    if (!client) throw new Error('no Alice')
    return { world, client }
  }

  it('says a file is missing where the world has none, and types one by its extension', async () => {
    const { world, client } = alice()
    world.writeFile('/disk/huge.pdf', 12_000_000)
    expect(await client.attachmentSendPlan('/disk/gone.pdf')).toBe('missing')
    expect(await client.attachmentSendPlan('/disk/huge.pdf')).toBe('too-large-for-server')
    expect(await client.attachmentSendPlan('/disk/huge.pdf', 'image/jpeg')).toBe('reencoded')
  })

  it('reads a file’s size from the platform behind an app, and a failed read is a missing file', async () => {
    const { client } = alice()
    const sizes = new Map([['/home/a/clip.mov', 20_000_000]])
    client.readStagedFilesWith({
      decodesHeic: true,
      sizeOf: (path) => {
        const size = sizes.get(path)
        return size === undefined ? Promise.reject(new Error('ENOENT')) : Promise.resolve(size)
      },
    })
    expect(await client.attachmentSendPlan('/home/a/clip.mov')).toBe('too-large-for-server')
    expect(await client.attachmentSendPlan('/home/a/gone.mov')).toBe('missing')
    expect(await client.attachmentSendPlan('/home/a/IMG_1.heic')).toBe('missing')
  })
})
