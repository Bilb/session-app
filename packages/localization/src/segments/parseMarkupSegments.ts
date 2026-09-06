import type { LocalizedSegment } from './types'

/**
 * Turns the markup inside a translated string into segments.
 *
 * The strings carry a little HTML - `<b>`, `<br/>` and `<span>` appear a few hundred times
 * across the English catalogue - because the clients that render them are web-based. React
 * Native has no innerHTML, so a shared component cannot take that route, and stripping the
 * tags would quietly drop emphasis the translators put there deliberately.
 *
 * parseLocalizedSegments handles the other half of the job: substituting `{args}` into
 * typed segments. This one handles the markup that is already in the template.
 *
 * Unknown tags are left as text rather than dropped, so a new tag appearing in the
 * catalogue shows up in the UI as something visibly wrong instead of vanishing silently.
 */
export function parseMarkupSegments(template: string): LocalizedSegment[] {
  const segments: LocalizedSegment[] = []
  const pattern = /<br\s*\/?>|<b>(.*?)<\/b>|<span>(.*?)<\/span>/gs

  let cursor = 0
  let match: RegExpExecArray | null

  const pushText = (value: string): void => {
    if (value.length > 0) segments.push({ type: 'text', value })
  }

  while ((match = pattern.exec(template)) !== null) {
    pushText(template.slice(cursor, match.index))

    const [whole, bold, span] = match
    if (bold !== undefined) {
      segments.push({ type: 'bold', value: bold })
    } else if (span !== undefined) {
      // <span> carries no meaning of its own in these strings; it groups text that an arg
      // is substituted into. Keeping it as text preserves the content.
      pushText(span)
    } else if (whole.startsWith('<br')) {
      // A line break is text, not a segment kind of its own: every renderer can draw "\n",
      // and a bespoke kind would need handling in each of them.
      pushText('\n')
    }

    cursor = match.index + whole.length
  }

  pushText(template.slice(cursor))
  return segments
}
