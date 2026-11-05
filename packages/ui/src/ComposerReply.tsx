import { XStack } from 'tamagui'

import type { ElementId } from '@session/test-ids'

import { Button } from './Button'
import { Icon } from './Icon'
import { inkFor } from './ink'
import { QuoteLines } from './MessageQuote'
import { quotePreview, type QuoteLabels, type QuotedMessage } from './quotePreview'
import { QuoteThumb } from './QuoteThumb'

/** Smaller than the quote's square: the bar holds one line of summary, not two. */
export const COMPOSER_REPLY_THUMB_SIDE_PX = 36

/** Takes the X's 32 px to the 48 a finger needs; a pointer needs no slop. */
const CLOSE_HIT_SLOP_PX = 8

export interface ComposerReplyProps {
  /** `messageReplyingTo`, already worded. */
  replyingToLabel: string
  /** Already worded: the nickname, display name or short account id, or "You". */
  author: string
  /** Absent: the message being answered is no longer here. The send still goes. */
  message: QuotedMessage | undefined
  labels: QuoteLabels
  onClose: () => void
  /** `close`, already worded. */
  closeLabel: string
  testID?: ElementId | undefined
  closeTestID?: ElementId | undefined
  thumbnailTestID?: ElementId | undefined
}

/**
 * Above the composer's input while a reply is being written: what it answers, in one line, and
 * the X that stops replying. Esc is the composer's to handle, since it is the input that has focus.
 */
export function ComposerReply({
  replyingToLabel,
  author,
  message,
  labels,
  onClose,
  closeLabel,
  testID,
  closeTestID,
  thumbnailTestID,
}: ComposerReplyProps) {
  const preview = quotePreview(message, labels)
  return (
    <XStack
      alignItems="center"
      gap="$xs"
      paddingVertical="$xs"
      paddingHorizontal="$sm"
      borderRadius="$md"
      backgroundColor="$backgroundTertiary"
      testID={testID}
    >
      <XStack flex={1} minWidth={0} alignSelf="stretch" gap="$xs">
        <QuoteLines
          heading={`${replyingToLabel} ${author}`}
          preview={preview}
          ink="$textPrimary"
          secondary={inkFor('secondary', false)}
          stripe="$primaryColor"
          summaryLines={1}
        />
      </XStack>
      <QuoteThumb
        visual={preview.visual}
        sidePx={COMPOSER_REPLY_THUMB_SIDE_PX}
        ink="$textPrimary"
        testID={thumbnailTestID}
      />
      <Button
        variant="ghost"
        size="sm"
        circular
        hitSlop={CLOSE_HIT_SLOP_PX}
        icon={<Icon name="x" size="sm" color="$textSecondary" />}
        accessibilityLabel={closeLabel}
        onPress={onClose}
        {...(closeTestID === undefined ? {} : { testID: closeTestID })}
      />
    </XStack>
  )
}
