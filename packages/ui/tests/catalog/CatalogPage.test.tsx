import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { CatalogPage } from '#src/catalog/CatalogPage'
import { catalogPages } from '#src/catalog/pages'
import { defineStory } from '#src/catalog/story'
import { Text } from '#src/Text'

import { declared } from '@session/render-tier'
import { renderInUI } from '../support/render'

const LONG = 'Failed before any file was up'

const story = defineStory<{ word: string }>({
  component: 'label',
  story: 'long',
  width: 120,
  variants: { [LONG]: { word: 'cell' }, phoneScreenshotNarrowWidest: { word: 'cell' } },
  render: ({ word }) => <Text>{word}</Text>,
})

describe('a catalog row’s label', () => {
  // The page waits on its fonts and pictures before it says it is ready; this DOM has neither.
  Object.defineProperty(document, 'fonts', {
    value: { ready: Promise.resolve() },
    configurable: true,
  })
  Object.defineProperty(document, 'images', { value: [], configurable: true })

  it('wraps rather than being cut to one line, inside a long key too', () => {
    const [page] = catalogPages('pr', [story])
    renderInUI(<CatalogPage page={page!} />)
    for (const row of [LONG, 'phoneScreenshotNarrowWidest']) {
      const label = declared(screen.getAllByText(row)[0]!)
      expect(label['text-overflow']).not.toBe('ellipsis')
      expect(label['white-space']).not.toBe('nowrap')
      expect(label['overflow-wrap']).toBe('anywhere')
    }
  })
})
