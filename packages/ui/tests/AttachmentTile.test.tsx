import { act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ELEMENT } from '@session/test-ids'

import { AttachmentTile } from '#src/AttachmentTile'

import { byId, declared } from '@session/render-tier'
import { renderInUI } from './support/render'

const PICTURE = ELEMENT.conversation.attachmentImage
const THUMBNAIL = 'session-media://thumbnail/1/0'

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

function tile() {
  return <AttachmentTile width={120} height={120} uri={THUMBNAIL} testID={PICTURE} />
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
    renderInUI(tile())
    expect(pictureLayer()).toBe('0')
    await answer(THUMBNAIL, 'load')
    expect(pictureLayer()).toBe('1')
  })

  // A thumbnail is made only of a picture that decoded, so one that does not load was evicted
  // under the tile: drawn as failed, a picture that is fine would read as broken.
  it('never wears a failed face: a picture that does not load leaves the placeholder', async () => {
    const { container } = renderInUI(tile())
    const before = drawnAround(container)
    await answer(THUMBNAIL, 'error')
    expect(pictureLayer()).toBe('0')
    expect(drawnAround(container)).toBe(before)
  })

  it('covers its square with a thumbnail of any shape, cropping rather than letterboxing', () => {
    renderInUI(tile())
    const layers = [byId(PICTURE), ...byId(PICTURE).querySelectorAll('div')]
    expect(layers.map((layer) => declared(layer)['background-size'])).toContain('cover')
  })
})
