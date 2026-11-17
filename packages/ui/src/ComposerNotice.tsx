import type { ElementId } from '@session/test-ids'
import { XStack, YStack } from 'tamagui'

import { nameDirection } from './attachmentFile'
import { Button } from './Button'
import { FileName } from './FileName'
import { inkFor } from './ink'
import { Icon } from './Icon'
import { Text } from './Text'

export interface ComposerNoticeProps {
  message: string
  /** What it was about: a file's name and size, or how many were left out. */
  detail?: string | undefined
  /** The file's name where `detail` holds one: that run loses its middle, not its extension. */
  detailName?: string | undefined
  onDismiss: () => void
  dismissLabel: string
  testID: ElementId
  dismissTestID: ElementId
}

const DETAIL_INK = inkFor('secondary', false)

function DetailRun({ text }: { text: string }) {
  if (text.length === 0) return null
  return (
    // pre: a run's own edge spaces, around the name, would otherwise be dropped.
    <Text size="$label" {...DETAIL_INK} numberOfLines={1} flexShrink={0} whiteSpace="pre">
      {text}
    </Text>
  )
}

function Detail({ detail, name }: { detail: string; name: string | undefined }) {
  const at = name === undefined || name.length === 0 ? -1 : detail.indexOf(name)
  if (name === undefined || at < 0)
    return (
      <Text size="$label" {...DETAIL_INK} numberOfLines={1}>
        {detail}
      </Text>
    )
  // The line keeps its own direction, as a file name does, or a Latin line under Arabic draws
  // the size before the name; it still starts from the layout's edge, under the message.
  return (
    <XStack
      alignSelf="flex-start"
      maxWidth="100%"
      minWidth={0}
      style={{ direction: nameDirection(detail) }}
      aria-label={detail}
    >
      <DetailRun text={detail.slice(0, at)} />
      {/* A column, which stretches the name to its own width so the name has a width to lose. */}
      <YStack flexShrink={1} minWidth={0}>
        <FileName name={name} size="$label" weight="regular" ink={DETAIL_INK} />
      </YStack>
      <DetailRun text={detail.slice(at + name.length)} />
    </XStack>
  )
}

/**
 * Why the composer did not take something, shown where it happened rather than in a toast.
 *
 * Drawn only: the composer says every notice of a refusal in one `Announcement`, since notices
 * announced one by one cut each other off.
 *
 * **The words are body text and only the glyph is red.** The danger colour clears 4.5:1 on the
 * page but not on the composer's surface in the dark themes (4.0:1), and the glyph needs only 3:1.
 */
export function ComposerNotice({
  message,
  detail,
  detailName,
  onDismiss,
  dismissLabel,
  testID,
  dismissTestID,
}: ComposerNoticeProps) {
  return (
    <XStack
      alignItems="center"
      gap="$xs"
      paddingVertical="$2xs"
      paddingHorizontal="$sm"
      borderRadius="$md"
      backgroundColor="$backgroundTertiary"
      testID={testID}
    >
      <Icon name="triangleAlert" size="sm" color="$dangerColor" />
      <YStack flex={1} minWidth={0} gap="$3xs" paddingVertical="$2xs">
        <Text size="$body" weight="semibold">
          {message}
        </Text>
        {detail === undefined ? null : <Detail detail={detail} name={detailName} />}
      </YStack>
      <Button
        variant="ghost"
        size="sm"
        circular
        icon={<Icon name="x" size="sm" color="$textSecondary" />}
        accessibilityLabel={dismissLabel}
        onPress={onDismiss}
        testID={dismissTestID}
      />
    </XStack>
  )
}
