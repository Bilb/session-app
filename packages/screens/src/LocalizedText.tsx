import { parseMarkupSegments, type LocalizedSegment } from '@session/localization'
import { Text } from '@session/ui'
import type { ComponentProps } from 'react'

/**
 * A translated string, with the emphasis the translators put in it.
 *
 * The catalogue carries a little HTML - bold and line breaks, a few hundred times over -
 * because the clients that render it today are web-based. React Native has no innerHTML, so
 * this walks the parsed segments and nests Text instead. That works identically on both
 * platforms, which is what lets the strings be used as they are rather than generated into
 * a second, platform-specific form.
 */
export function LocalizedText({
  text,
  ...textProps
}: { text: string } & Omit<ComponentProps<typeof Text>, 'children'>) {
  const segments = parseMarkupSegments(text)

  return (
    <Text {...textProps}>{segments.map((segment, index) => renderSegment(segment, index))}</Text>
  )
}

function renderSegment(segment: LocalizedSegment, index: number) {
  const key = `${segment.type}-${String(index)}`

  switch (segment.type) {
    case 'bold':
      return (
        <Text key={key} weight="bold">
          {segment.value}
        </Text>
      )
    case 'italic':
      return (
        <Text key={key} fontStyle="italic">
          {segment.value}
        </Text>
      )
    case 'mono':
      return (
        <Text key={key} fontFamily="$body">
          {segment.value}
        </Text>
      )
    case 'text':
    case 'emoji':
    case 'bidi':
      return segment.value
    case 'icon':
      // Icons arrive as a unicode point in the icon font; drawn as text on both platforms.
      return segment.unicode
    default:
      return null
  }
}
