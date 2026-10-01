import { afterEach, describe, expect, it, vi } from 'vitest'

import { backlog } from '#src/fake/backlog'
import { driveFakeClock, FAKE_TICK_MS, pickFakeFixture } from '#src/fake/devSetup'
import { photoFileName, photoFileNames } from '#src/fake/media'

afterEach(() => {
  vi.useRealTimers()
})

describe('the world a dev fake starts in', () => {
  it('is the two friends with attachments when nothing is set', () => {
    expect(pickFakeFixture({}).fixture).toBe('friends')
  })

  it('is the one EXPO_PUBLIC_SESSION_FAKE_FIXTURE names', () => {
    expect(pickFakeFixture({ fixture: 'backlog' }).fixture).toBe('backlog')
    expect(pickFakeFixture({ fixture: 'showcase' }).fixture).toBe('showcase')
  })

  it('still answers the older variables', () => {
    expect(pickFakeFixture({ noAccount: '1' }).fixture).toBe('newcomer')
    expect(pickFakeFixture({ showcase: '1' }).fixture).toBe('showcase')
    expect(pickFakeFixture({ conversations: '3' }).fixture).toBe('crowd')
  })

  it('refuses a name that is not a fixture, rather than opening another world', () => {
    expect(() => pickFakeFixture({ fixture: 'showcse' })).toThrow(/not a fixture/)
  })
})

describe('the backlog fixture', () => {
  it('holds many conversations of attachments, none of them downloaded', async () => {
    const { world, clients } = backlog()
    const alice = clients['Alice']
    if (!alice) throw new Error('no Alice')
    const conversations = await alice.getConversations()
    expect(conversations.length).toBeGreaterThanOrEqual(7)

    let withAttachments = 0
    for (const conversation of conversations) {
      const { messages } = await alice.getMessages(conversation.id, { limit: 100 })
      for (const message of messages) {
        if (message.attachments.length === 0) continue
        withAttachments += 1
        for (const attachment of message.attachments) {
          expect(['absent', 'notFound']).toContain(attachment.availability)
        }
      }
    }
    expect(withAttachments).toBeGreaterThanOrEqual(100)
    expect(world.now()).toBeGreaterThan(0)
  })
})

describe('the fake photographs', () => {
  it('are thirty, one per ThumbHash', () => {
    expect(photoFileNames()).toHaveLength(30)
    expect(photoFileNames()[0]).toBe('unsplash-01.jpg')
  })

  it('give every picture one, and nothing to a file', async () => {
    const { world, clients } = backlog()
    const alice = clients['Alice']
    if (!alice) throw new Error('no Alice')
    const [conversation] = await alice.getConversations()
    if (!conversation) throw new Error('no conversation')
    const { messages } = await alice.getMessages(conversation.id, { limit: 100 })
    for (const message of messages) {
      for (const attachment of message.attachments) {
        const photo = photoFileName(alice, { messageId: message.id, index: attachment.index })
        const picture = /^(image|video)\//.test(attachment.contentType ?? '')
        expect(photo === null).toBe(!picture)
      }
    }
    expect(world).toBeDefined()
  })
})

describe('the dev clock', () => {
  it('drains the queue each tick when not slowed', () => {
    vi.useFakeTimers()
    const settle = vi.fn()
    const advance = vi.fn()
    const stop = driveFakeClock({ settle, advance } as never, undefined)
    vi.advanceTimersByTime(FAKE_TICK_MS)
    expect(settle).toHaveBeenCalledOnce()
    expect(advance).not.toHaveBeenCalled()
    stop()
  })

  it('advances a slice of each tick when EXPO_PUBLIC_SESSION_FAKE_SLOWDOWN is set', () => {
    vi.useFakeTimers()
    const settle = vi.fn()
    const advance = vi.fn()
    const stop = driveFakeClock({ settle, advance } as never, '10')
    vi.advanceTimersByTime(FAKE_TICK_MS)
    expect(advance).toHaveBeenCalledWith(FAKE_TICK_MS / 10)
    expect(settle).not.toHaveBeenCalled()
    stop()
  })
})
