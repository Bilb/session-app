import { parseMarkupSegments } from './parseMarkupSegments'

/**
 * A translated string as plain text, for somewhere nothing will render its markup: a share sheet,
 * the clipboard.
 *
 * The markup is resolved rather than deleted -- `<br/>` becomes a line break and `<b>` its text --
 * so a message that leaves the app keeps the paragraphs the translators wrote. Stripping the tags
 * instead runs the lines together. Unknown tags stay visible, as the parser leaves them.
 */
export function toPlainText(template: string): string {
  return parseMarkupSegments(template)
    .map((segment) => ('value' in segment ? segment.value : ''))
    .join('')
}
