export type InkTone = 'primary' | 'secondary' | 'danger' | 'link'

/** What the ink sits on: the page, a card or a received bubble, or a bubble you sent. */
export type InkSurface = 'page' | 'accent'

const PAGE_INK = {
  primary: '$textPrimary',
  secondary: '$textSecondary',
  danger: '$dangerText',
  link: '$accentText',
} as const satisfies Record<InkTone, string>

type Ink = (typeof PAGE_INK)[InkTone] | '$onAccent' | '$onAccentSecondary'

/**
 * The colour of text or a glyph in a given tone, on `surface`.
 *
 * On the accent every tone is an on-colour: red or an accent-coloured link on the accent is
 * unreadable, so a failure has to be said by its words and glyph alone there.
 */
export function inkFor(tone: InkTone, surface: InkSurface): { color: Ink } {
  if (surface === 'accent')
    return { color: tone === 'secondary' ? '$onAccentSecondary' : '$onAccent' }
  return { color: PAGE_INK[tone] }
}
