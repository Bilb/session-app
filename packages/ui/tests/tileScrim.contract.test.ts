import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(join(import.meta.dirname, '../..', path), 'utf8')

/** Held by reading the source: axe does not measure text over a photograph. */
describe('what is drawn on the tile scrim', () => {
  // Both scrims are dark in every theme, so their ink is the role that is light in every theme.
  it.each(['ui/src/AttachmentTile.tsx', 'ui/src/FetchHint.tsx'])(
    'in %s is light in every theme',
    (path) => {
      const file = source(path)
      expect(file).toMatch(/TILE_(SLOT_)?SCRIM/)
      expect(file).toContain('$surfaceInverted')
      expect(file).not.toContain('$textPrimary')
    },
  )

  it('takes the light ink in the media viewer only where its button is over the picture', () => {
    expect(source('ui/src/MediaViewer.tsx')).toContain(
      "color={overMedia ? '$surfaceInverted' : '$textPrimary'}",
    )
  })
})
