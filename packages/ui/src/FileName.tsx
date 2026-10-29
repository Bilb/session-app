import type { ElementId } from '@session/test-ids'
import { XStack } from 'tamagui'

import { nameDirection, splitFilename } from './attachmentFile'
import type { inkFor } from './ink'
import { Text, type TextSize } from './Text'

export interface FileNameProps {
  name: string
  size: TextSize
  ink?: ReturnType<typeof inkFor> | undefined
  testID?: ElementId | undefined
}

/**
 * A file's name on one line, losing its middle rather than its extension when it does not fit.
 *
 * Two runs: the head gives up whatever width is short and the tail cannot. See `splitFilename`.
 * They lay out in the name's own direction, not the layout's, or a Latin name under Arabic draws
 * its tail first.
 */
export function FileName({ name, size, ink, testID }: FileNameProps) {
  const { head, tail } = splitFilename(name)
  return (
    // The id and the label are on the pair, never on a run: split between two elements the name
    // stops being one string, and both a screen reader and a test then read half.
    <XStack
      minWidth={0}
      style={{ direction: nameDirection(name) }}
      aria-label={name}
      testID={testID}
    >
      <Text
        size={size}
        weight="semibold"
        {...ink}
        numberOfLines={1}
        ellipsizeMode="tail"
        flexShrink={1}
        minWidth={0}
      >
        {head}
      </Text>
      <Text size={size} weight="semibold" {...ink} numberOfLines={1} flexShrink={0}>
        {tail}
      </Text>
    </XStack>
  )
}
