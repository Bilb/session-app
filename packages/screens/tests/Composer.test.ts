import { memoryPorts, resetPorts, setPorts, type PickedFile } from '@session/app'
import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import type * as React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Composer } from '#src/Composer'
import { useStaging, type StagingState } from '#src/useStaging'

/**
 * A renderer just big enough for the composer: hook state lives in slots taken in call order, as
 * React's does, and a render walks the element tree it returns, running its local components.
 */
const hooks = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0 }))

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof React>()),
  useState: (initial: unknown) => {
    const at = hooks.cursor++
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
    const at = hooks.cursor++
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

/** One render of a conversation's composer and the staging it is given. */
function render(): { staging: StagingState; find: (testID: string) => Element | undefined } {
  hooks.cursor = 0
  const staging = useStaging()
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
})

afterEach(() => {
  resetPorts()
})

describe('the composer while a send is out', () => {
  it('sends once however often Send is pressed', async () => {
    const answer = deferred()
    onSend = vi.fn(() => answer.promise)
    render().staging.add([photo])
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

  it('disables removing and clearing what it is sending', () => {
    onSend = vi.fn(() => deferred().promise)
    render().staging.add([photo])
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
    render().staging.add(files)
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
