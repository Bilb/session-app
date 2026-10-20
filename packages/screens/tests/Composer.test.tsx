import { memoryPorts, resetPorts, setPorts, type PickedFile } from '@session/app'
import type { SendPlan } from '@session/client'
import { PENDING_COPY, tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import type * as React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Composer } from '#src/Composer'
import { useStaging, type StagingState } from '#src/useStaging'

/**
 * A renderer just big enough for the composer: hook state lives in slots taken in call order, as
 * React's does, and a render walks the element tree it returns, running its local components.
 */
const hooks = vi.hoisted(() => ({ slots: [] as unknown[], nextSlot: 0 }))

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof React>()),
  useState: (initial: unknown) => {
    const at = hooks.nextSlot++
    if (!(at in hooks.slots)) hooks.slots[at] = initial
    return [
      hooks.slots[at],
      (value: unknown) => {
        hooks.slots[at] =
          typeof value === 'function'
            ? (value as (was: unknown) => unknown)(hooks.slots[at])
            : value
      },
    ]
  },
  useRef: (current: unknown) => {
    const at = hooks.nextSlot++
    if (!(at in hooks.slots)) hooks.slots[at] = { current }
    return hooks.slots[at]
  },
  useCallback: (callback: unknown) => callback,
  useEffect: () => undefined,
}))

vi.mock('@session/ui', () => {
  const named = (name: string) => name
  return {
    ATTACH_OPENS_MENU: false,
    Announcement: named('Announcement'),
    Button: named('Button'),
    ComposerNotice: named('ComposerNotice'),
    Icon: named('Icon'),
    Input: named('Input'),
    PressArea: named('PressArea'),
    Sheet: named('Sheet'),
    StagedTile: named('StagedTile'),
    StagedTray: named('StagedTray'),
    Text: named('Text'),
    XStack: named('XStack'),
    YStack: named('YStack'),
  }
})

interface Element {
  type: unknown
  props: Record<string, unknown> & { children?: unknown }
}

function isElement(node: unknown): node is Element {
  return typeof node === 'object' && node !== null && 'props' in node && 'type' in node
}

/** Every host element below `node`, local components rendered in place. */
function hostElements(node: unknown): Element[] {
  if (Array.isArray(node)) return node.flatMap(hostElements)
  if (!isElement(node)) return []
  if (typeof node.type === 'function')
    return hostElements((node.type as (props: unknown) => unknown)(node.props))
  return [node, ...hostElements(node.props.children)]
}

let onSend: ReturnType<typeof vi.fn<(body: string, files: readonly PickedFile[]) => Promise<void>>>
let planSend: (file: PickedFile) => Promise<SendPlan>

/** One render of a conversation's composer and the staging it is given. */
function render(): { staging: StagingState; find: (testID: string) => Element | undefined } {
  hooks.nextSlot = 0
  const staging = useStaging((file) => planSend(file))
  const tree = Composer({ staging, onSend })
  const elements = hostElements(tree)
  return {
    staging,
    // The announcement has no test id, and there is one.
    find: (testID) =>
      elements.find((element) =>
        testID === 'announcement'
          ? element.type === 'Announcement'
          : element.props.testID === testID,
      ),
  }
}

function press(testID: string): void {
  const target = render().find(testID)
  ;(target?.props.onPress as () => void)()
}

function type(text: string): void {
  ;(render().find(ELEMENT.conversation.composerInput)?.props.onChangeText as (t: string) => void)(
    text,
  )
}

function deferred() {
  let settle: { resolve: () => void; reject: (error: Error) => void } | undefined
  const promise = new Promise<void>((resolve, reject) => {
    settle = { resolve, reject }
  })
  return { promise, ...(settle as NonNullable<typeof settle>) }
}

const PHOTO_BYTES = 4

const photo: PickedFile = { path: '/home/a/photo.jpg', name: 'photo.jpg', size: PHOTO_BYTES }

beforeEach(() => {
  setPorts(memoryPorts())
  hooks.slots = []
  planSend = () => Promise.resolve('as-is')
})

afterEach(() => {
  resetPorts()
})

describe('the composer while a send is out', () => {
  it('sends once however often Send is pressed', async () => {
    const answer = deferred()
    onSend = vi.fn(() => answer.promise)
    await render().staging.add([photo])
    type('hi')
    press(ELEMENT.conversation.sendButton)
    press(ELEMENT.conversation.sendButton)
    expect(render().find(ELEMENT.conversation.sendButton)?.props.disabled).toBe(true)
    expect(onSend).toHaveBeenCalledTimes(1)
    answer.resolve()
    await answer.promise
    await Promise.resolve()
    expect(render().staging.files).toEqual([])
  })

  it('holds the staging as sending until libsession answers, either way', async () => {
    for (const settle of ['resolve', 'reject'] as const) {
      const answer = deferred()
      onSend = vi.fn(() => answer.promise)
      type('hi')
      press(ELEMENT.conversation.sendButton)
      expect(render().staging.sending).toBe(true)
      answer[settle](new Error('refused'))
      await answer.promise.catch(() => undefined)
      await Promise.resolve()
      expect(render().staging.sending).toBe(false)
    }
  })

  it('disables removing and clearing what it is sending', async () => {
    onSend = vi.fn(() => deferred().promise)
    await render().staging.add([photo])
    press(ELEMENT.conversation.sendButton)
    const { find } = render()
    expect(find(ELEMENT.conversation.stagedTray)?.props.clearDisabled).toBe(true)
    expect(find(ELEMENT.conversation.stagedTile(0))?.props.removeDisabled).toBe(true)
  })
})

describe('the draft after a send went', () => {
  async function sendWhileTyping(sent: string, ...meanwhile: string[]): Promise<unknown> {
    const answer = deferred()
    onSend = vi.fn(() => answer.promise)
    type(sent)
    press(ELEMENT.conversation.sendButton)
    for (const typed of meanwhile) type(typed)
    answer.resolve()
    await answer.promise
    await Promise.resolve()
    return render().find(ELEMENT.conversation.composerInput)?.props.value
  }

  it('is empty when nothing was typed while it was out', async () => {
    expect(await sendWhileTyping('hi')).toBe('')
  })

  it('keeps only what was typed after the sent text', async () => {
    expect(await sendWhileTyping('hi', 'hi ', 'hi there')).toBe('there')
  })

  it('keeps a draft cleared and retyped whole, even one starting with the sent text', async () => {
    expect(await sendWhileTyping('ok', '', 'o', 'ok', 'okay')).toBe('okay')
  })
})

describe('a refused send', () => {
  it.each([
    ['with files', [photo], tr('attachmentsErrorSending')],
    ['of text alone', [], tr('messageStatusFailedToSend')],
  ])('%s keeps the draft and the tray and says it failed', async (_, files, message) => {
    const answer = deferred()
    onSend = vi.fn(() => answer.promise)
    await render().staging.add(files)
    type('hi')
    press(ELEMENT.conversation.sendButton)
    answer.reject(new Error('refused'))
    await answer.promise.catch(() => undefined)
    await Promise.resolve()
    const { staging, find } = render()
    expect(staging.files).toEqual(files)
    expect(find(ELEMENT.conversation.composerInput)?.props.value).toBe('hi')
    expect(find(ELEMENT.conversation.composerNotice('send'))?.props.message).toBe(message)
    expect(find('announcement')?.props.text).toBe(`${message}.`)
  })
})

describe('staging by libsession’s plan', () => {
  it.each([
    ['too-large-for-server', 'size', tr('attachmentsErrorSize')],
    ['too-large-to-decode', 'pixels', PENDING_COPY.attachmentsErrorImageTooLarge],
    ['unreadable', 'open', tr('attachmentsErrorOpen')],
    ['missing', 'open', tr('attachmentsErrorOpen')],
  ] as const)('refuses a file planned %s, naming it', async (plan, id, message) => {
    planSend = (file) => Promise.resolve(file === photo ? plan : 'as-is')
    const notes: PickedFile = { path: '/home/a/notes.txt', name: 'notes.txt' }
    await render().staging.add([photo, notes])
    const { staging, find } = render()
    expect(staging.files).toEqual([notes])
    const notice = find(ELEMENT.conversation.composerNotice(id))
    expect(notice?.props.message).toBe(message)
    expect(String(notice?.props.detail)).toMatch(/^photo\.jpg/)
    expect(find('announcement')?.props.text).toContain('photo.jpg')
  })

  it.each(['reencoded', 'as-is', 'original-cannot-decode', 'original-animated-png'] as const)(
    'stages a file planned %s',
    async (plan) => {
      planSend = () => Promise.resolve(plan)
      await render().staging.add([photo])
      expect(render().staging.files).toEqual([photo])
      expect(render().staging.refused.tooLarge).toEqual([])
    },
  )

  it('refuses a file whose plan could not be asked for', async () => {
    planSend = () => Promise.reject(new Error('bridge closed'))
    await render().staging.add([photo])
    expect(render().staging.files).toEqual([])
    expect(render().find(ELEMENT.conversation.composerNotice('open'))).toBeDefined()
  })

  it('holds Send until every plan is in, and sends the files with the text', async () => {
    let answer: (plan: SendPlan) => void = () => undefined
    planSend = () =>
      new Promise((resolve) => {
        answer = resolve
      })
    onSend = vi.fn(() => deferred().promise)
    const staged = render().staging.add([photo])
    type('hi')
    expect(render().staging.planning).toBe(true)
    expect(render().find(ELEMENT.conversation.sendButton)?.props.disabled).toBe(true)
    press(ELEMENT.conversation.sendButton)
    expect(onSend).not.toHaveBeenCalled()
    answer('reencoded')
    await staged
    expect(render().find(ELEMENT.conversation.sendButton)?.props.disabled).toBe(false)
    press(ELEMENT.conversation.sendButton)
    expect(onSend).toHaveBeenCalledWith('hi', [photo])
  })

  it('stages picks in the order they were made, whichever plan answers first', async () => {
    const answers: ((plan: SendPlan) => void)[] = []
    planSend = () =>
      new Promise((resolve) => {
        answers.push(resolve)
      })
    const notes: PickedFile = { path: '/home/a/notes.txt', name: 'notes.txt' }
    const first = render().staging.add([photo])
    const second = render().staging.add([notes])
    answers[1]?.('as-is')
    answers[0]?.('reencoded')
    await Promise.all([first, second])
    expect(render().staging.files).toEqual([photo, notes])
  })
})
