import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { Text } from '#src/Text'

import { renderInUI } from './support/render'

const css = readFileSync(join(import.meta.dirname, '../src/tamaguiCSS.ts'), 'utf8')

/** jsdom does no bidi, so the rule is read from the source and its selector checked on a Text. */
describe('a text on the web', () => {
  it('takes its direction from its first letter and its side from the layout', () => {
    expect(css).toContain(
      ':where(.is_Text) { unicode-bidi: plaintext; text-align: -webkit-match-parent; }',
    )
    expect(css).toMatch(/style\.textContent = `[^`]*\$\{TEXT_DIRECTION\}/)
  })

  it('carries the class that rule selects', () => {
    const { getByText } = renderInUI(<Text>Hello!</Text>)
    expect(getByText('Hello!').classList).toContain('is_Text')
  })
})
