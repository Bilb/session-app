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
  (typeof PAGE_INK)[InkTone] | '$onAccent' | '$onAccentSecondary' | '$messageBubbleIncomingText'

/**
 * The colour of text or a glyph in a given tone, on `surface`.
 *
 * On the accent every tone is an on-colour: red or an accent-coloured link on the accent is
 * unreadable, so a failure has to be said by its words and glyph alone there. On a received bubble
 * only the glyph stays red, since no red clears 4.5:1 as text on Ocean Dark's bubble.
 */
export function inkFor(
  tone: InkTone,
  surface: InkSurface,
  mark: 'text' | 'glyph' = 'text',
): { color: Ink } {
  if (surface === 'accent')
    return { color: tone === 'secondary' ? '$onAccentSecondary' : '$onAccent' }
  if (surface === 'received' && tone === 'danger' && mark === 'text')
    return { color: '$messageBubbleIncomingText' }
  return { color: PAGE_INK[tone] }
}
