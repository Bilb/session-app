import { isolate } from '@session/localization'
import { isLayoutRtl } from '@session/ui'

/** LEFT-TO-RIGHT MARK and RIGHT-TO-LEFT MARK. */
const LRM = '‎'
const RLM = '‏'

/**
 * Parts of one line, each isolated and joined by `separator`, running from the layout's start edge.
 *
 * Every text takes its direction from its own first strong letter, on the web as on a device. A
 * line made only of sizes and Latin units would therefore read left to right under a right-to-left
 * layout, with the first figure on the left. The leading mark is that first letter, and isolating
 * each part keeps a part's own letters from deciding it instead. Neither mark has a glyph or width.
 *
 * Read when the line is built, so it is current for a render below `useTextDirection`.
 */
export function layoutLine(separator: string, ...parts: string[]): string {
  return `${isLayoutRtl() ? RLM : LRM}${parts.map(isolate).join(separator)}`
}
