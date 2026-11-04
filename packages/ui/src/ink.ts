export type InkTone = 'primary' | 'secondary' | 'danger' | 'link'

/** What the ink sits on: the page or a card, a bubble someone else sent, or a bubble you sent. */
export type InkSurface = 'page' | 'received' | 'accent'

const PAGE_INK = {
  primary: '$textPrimary',
  secondary: '$textSecondary',
  danger: '$dangerText',
  link: '$accentText',
} as const satisfies Record<InkTone, string>

type Ink =
  (typeof PAGE_INK)[InkTone] | '$onAccent' | '$onAccentSecondary' | '$messageBubbleIncomingDanger'

/**
 * The colour of text or a glyph in a given tone, on `surface`.
 *
 * On the accent every tone is an on-colour: red or an accent-coloured link on the accent is
 * unreadable, so a failure has to be said by its words and glyph alone there. Red text on a
 * received bubble is red only in the themes where it is legible there; a glyph owes 3:1, which the
 * page's red clears on every bubble.
 */
export function inkFor(
  tone: InkTone,
  surface: InkSurface,
  mark: 'text' | 'glyph' = 'text',
): { color: Ink } {
  if (surface === 'accent')
    return { color: tone === 'secondary' ? '$onAccentSecondary' : '$onAccent' }
  if (surface === 'received' && tone === 'danger' && mark === 'text')
    return { color: '$messageBubbleIncomingDanger' }
  return { color: PAGE_INK[tone] }
}
