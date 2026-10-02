import { isIconToMirrorRtl } from './lucideUnicode'
import type {
  BidiSegment,
  BoldSegment,
  EmojiSegment,
  IconSegment,
  ItalicSegment,
  LocalizedSegment,
  MonoSegment,
  TextSegment,
} from './types'
import type { SegmentArg } from './argWrappers'

/**
 * Turns a translated template string + typed args into a flat segment list.
 *
 * Splits on ALL placeholder keys at once so that string arg values containing
 * patterns like "{icon}" are never re-scanned - they land directly in a TextSegment.
 *
 * Example: parseLocalizedSegments('Tap {icon} to share', { icon: icon(LUCIDE_ICONS_UNICODE.SHARE)
 * }) => [{ type: 'text', value: 'Tap ' }, { type: 'icon', unicode: ..., rtlMirror: false }, { type:
 * 'text', value: ' to share' }]
 */
export function parseLocalizedSegments(
  rawTemplate: string,
  args: Record<string, SegmentArg> = {},
): Array<LocalizedSegment> {
  const keys = Object.keys(args)

  if (keys.length === 0) {
    if (rawTemplate.length === 0) {
      return []
    }
    return [{ type: 'text', value: rawTemplate }]
  }

  const escapedKeys = keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const pattern = new RegExp(`(${escapedKeys.map((k) => `\\{${k}\\}`).join('|')})`)
  const parts = rawTemplate.split(pattern)

  const segments: Array<LocalizedSegment> = []

  for (const part of parts) {
    if (part.length === 0) {
      continue
    }

    const placeholderMatch = /^\{(\w+)\}$/.exec(part)
    if (placeholderMatch) {
      const key = placeholderMatch[1]!
      const arg = args[key]
      if (arg === undefined) {
        segments.push({ type: 'text', value: part } satisfies TextSegment)
        continue
      }
      if (typeof arg === 'string') {
        if (arg.length > 0) {
          segments.push({ type: 'text', value: arg } satisfies TextSegment)
        }
        continue
      }
      switch (arg.__kind) {
        case 'icon': {
          const seg: IconSegment = {
            type: 'icon',
            unicode: arg.unicode,
            rtlMirror: isIconToMirrorRtl(arg.unicode),
          }
          segments.push(seg)
          break
        }
        case 'emoji': {
          segments.push({ type: 'emoji', value: arg.value } satisfies EmojiSegment)
          break
        }
        case 'bold': {
          segments.push({ type: 'bold', value: arg.value } satisfies BoldSegment)
          break
        }
        case 'mono': {
          segments.push({ type: 'mono', value: arg.value } satisfies MonoSegment)
          break
        }
        case 'italic': {
          segments.push({ type: 'italic', value: arg.value } satisfies ItalicSegment)
          break
        }
        case 'bidi': {
          segments.push({ type: 'bidi', value: arg.value } satisfies BidiSegment)
          break
        }
      }
      continue
    }

    segments.push({ type: 'text', value: part } satisfies TextSegment)
  }

  return segments
}
