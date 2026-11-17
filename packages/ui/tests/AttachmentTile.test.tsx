import { act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ELEMENT } from '@session/test-ids'

import { AttachmentTile } from '#src/AttachmentTile'

import { byId, declared } from '@session/render-tier'
import { renderInUI } from './support/render'

const PICTURE = ELEMENT.conversation.attachmentImage

/**
 * A url of its own for each test: which urls have loaded is remembered across tiles, so a url
 * shared between tests would carry one test's load into the next.
 */
const thumbnail = (message: number) => `session-media://thumbnail/${message}/0`

/** What react-native-web's loader asks of a picture, answered by the test: happy-dom loads none. */
class AskedImage {
  static asked: AskedImage[] = []
  src = ''
  onload: ((event: unknown) => void) | null = null
  onerror: (() => void) | null = null
  constructor() {
    AskedImage.asked.push(this)
  }
}

const loader = window.Image

beforeEach(() => {
  AskedImage.asked = []
  window.Image = AskedImage as unknown as typeof window.Image
})

afterEach(() => {
  window.Image = loader
})

/** Answers every request for `uri`, then lets react-native-web's deferred report run. */
async function answer(uri: string, outcome: 'load' | 'error'): Promise<void> {
  await act(async () => {
    for (const image of AskedImage.asked.filter((asked) => asked.src === uri)) {
      if (outcome === 'load') image.onload?.({})
      else image.onerror?.()
    }
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

function tile(uri: string, side = 120) {
  return <AttachmentTile width={side} height={side} uri={uri} testID={PICTURE} />
}

/** The picture's own layer, which the tile shows only once its bytes are on screen. */
const pictureLayer = () => declared(byId(PICTURE).parentElement!).opacity

/** What the tile draws round the picture, leaving out react-native-web's own image inside it. */
function drawnAround(container: Element): string {
  const copy = container.cloneNode(true) as Element
  copy.querySelector(`[data-testid="${PICTURE}"]`)?.replaceChildren()
  return copy.innerHTML
}

describe('an attachment tile’s picture', () => {
  it('shows once it reports that it landed', async () => {
    renderInUI(tile(thumbnail(1)))
    expect(pictureLayer()).toBe('0')
    await answer(thumbnail(1), 'load')
    expect(pictureLayer()).toBe('1')
  })

  // A tile the album moves to another row remounts, at another size; waiting for the load to come
  // back would flash the placeholder over a picture that is already decoded.
  it('shows at once, before it reports, when remounted for a url that loaded before', async () => {
    const first = renderInUI(tile(thumbnail(2)))
    await answer(thumbnail(2), 'load')
    first.unmount()
    renderInUI(tile(thumbnail(2), 90))
    expect(pictureLayer()).toBe('1')
  })

  it('still starts hidden for a url that never loaded, whatever loaded before it', async () => {
    const first = renderInUI(tile(thumbnail(3)))
    await answer(thumbnail(3), 'load')
    first.unmount()
    renderInUI(tile(thumbnail(4)))
    expect(pictureLayer()).toBe('0')
  })

  it('forgets a url that loaded before once it fails, its bytes evicted since', async () => {
    const first = renderInUI(tile(thumbnail(5)))
    await answer(thumbnail(5), 'load')
    first.unmount()
    const second = renderInUI(tile(thumbnail(5)))
    await answer(thumbnail(5), 'error')
    expect(pictureLayer()).toBe('0')
    second.unmount()
    renderInUI(tile(thumbnail(5)))
    expect(pictureLayer()).toBe('0')
  })

  // A thumbnail is made only of a picture that decoded, so one that does not load was evicted
  // under the tile: drawn as failed, a picture that is fine would read as broken.
  it('never wears a failed face: a picture that does not load leaves the placeholder', async () => {
    const { container } = renderInUI(tile(thumbnail(6)))
    const before = drawnAround(container)
    await answer(thumbnail(6), 'error')
    expect(pictureLayer()).toBe('0')
    expect(drawnAround(container)).toBe(before)
  })

  it('covers its square with a thumbnail of any shape, cropping rather than letterboxing', () => {
    renderInUI(tile(thumbnail(7)))
    const layers = [byId(PICTURE), ...byId(PICTURE).querySelectorAll('div')]
    expect(layers.map((layer) => declared(layer)['background-size'])).toContain('cover')
  })
})
