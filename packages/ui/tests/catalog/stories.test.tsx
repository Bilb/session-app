import { describe, expect, it } from 'vitest'

import { STORIES } from '#src/catalog/stories/index'

import { renderInUI } from '../support/render'

const ROWS = STORIES.flatMap((story) =>
  Object.entries(story.variants).map(
    ([row, props]) => [`${story.component}.${story.story}`, row, story, props] as const,
  ),
)

/** What the provider alone mounts, which a row has to add to. */
function emptyElements(): number {
  const { container, unmount } = renderInUI(null)
  const count = container.querySelectorAll('*').length
  unmount()
  return count
}

describe('catalog stories', () => {
  // A row that throws or draws nothing is a blank cell in a capture nobody is asked to look at.
  it.each(ROWS)('%s draws its %s row', (_, __, story, props) => {
    const empty = emptyElements()
    const { container } = renderInUI(story.render(props))
    expect(container.querySelectorAll('*').length).toBeGreaterThan(empty)
  })
})
