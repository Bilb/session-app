import type { ReactNode } from 'react'
import { isWeb, XStack, YStack } from 'tamagui'

import type { ElementId } from '@session/test-ids'

import { FileName } from './FileName'
import { ON_ACCENT_SECONDARY_OPACITY, type inkFor } from './ink'
import { PressArea } from './PressArea'
import { PRESS_PASSTHROUGH } from './pressPassthrough'
import {
  quoteAccessibleName,
  quotePreview,
  type QuoteInk,
  type QuoteLabels,
  type QuotePreview,
  type QuotedMessage,
} from './quotePreview'
import { QuoteThumb } from './QuoteThumb'
import { StateLayer } from './StateLayer'
import { Text } from './Text'
import type { WithTestID } from './with'

/**
 * The quote's metrics, measured off the plan's mock rather than taken from the ladder: the
 * trailing square is the 44 pt target on its own, so the quote is never shorter than one.
 */
export const QUOTE_THUMB_SIDE_PX = 44
const QUOTE_INSET_PX = 6
const STRIPE_WIDTH_PX = 3

/** How far a quote tints its bubble towards the bubble's ink, which works in either polarity. */
const QUOTE_TINT_OPACITY = { incoming: 0.07, outgoing: 0.1 } as const

/** The stripe, the author and the summary, beside the trailing square: what the bar draws too. */
export function QuoteLines({
  heading,
  preview,
  ink,
  secondary,
  stripe,
  summaryLines,
}: {
  /** The author, or the bar's "Replying to" with the author. */
  heading: string
  preview: QuotePreview
  ink: QuoteInk
  secondary: { color: QuoteInk | ReturnType<typeof inkFor>['color']; opacity: number }
  stripe: '$onAccent' | '$primaryColor'
  /** The quote wraps a body to two lines; the composer's bar holds every summary to one. */
  summaryLines: 1 | 2
}) {
  return (
    <>
      <YStack width={STRIPE_WIDTH_PX} borderRadius="$full" backgroundColor={stripe} />
      <YStack flex={1} minWidth={0} justifyContent="center">
        <Text size="$label" weight="semibold" color={ink} numberOfLines={1}>
          {heading}
        </Text>
        {preview.isFileName ? (
          <XStack minWidth={0} gap="$2xs">
            {/* A column, which gives the name a width to lose its middle from. */}
            <YStack flexShrink={1} minWidth={0}>
              <FileName name={preview.text} size="$label" weight="regular" ink={secondary} />
            </YStack>
            {preview.more === null ? null : (
              <Text size="$label" {...secondary} flexShrink={0}>
                {preview.more}
              </Text>
            )}
          </XStack>
        ) : (
          <Text size="$label" {...secondary} numberOfLines={Math.min(preview.lines, summaryLines)}>
            {preview.text}
          </Text>
        )}
      </YStack>
    </>
  )
}

export type MessageQuoteProps = WithTestID & {
  /** Already worded: the nickname, display name or short account id, or "You". */
  author: string
  /** Absent: the reply points at a message this device does not hold. */
  message: QuotedMessage | undefined
  labels: QuoteLabels
  /** Drawn on a bubble you sent. */
  onAccent: boolean
  /**
   * Jumps to the original. A quote of one not found is no button, but a pointer or a tap still
   * calls this, for the toast that says so.
   */
  onPress?: (() => void) | undefined
  /** Already worded, for what a press does, after the name. */
  hint?: string | undefined
  /** The original is being read in. */
  busy?: boolean | undefined
  /** Addresses the picture in the trailing square, so a test can ask whether it arrived. */
  thumbnailTestID?: ElementId | undefined
}

function QuoteBody({
  author,
  preview,
  onAccent,
  busy,
  pressable,
  pressed = false,
  thumbnailTestID,
}: {
  author: string
  preview: QuotePreview
  onAccent: boolean
  busy: boolean
  pressable: boolean
  /** Reported by the native `PressArea`, whose frame cannot see its own press. */
  pressed?: boolean | undefined
  thumbnailTestID: ElementId | undefined
}): ReactNode {
  const ink = onAccent ? '$onAccent' : '$messageBubbleIncomingText'
  return (
    <XStack
      {...(pressable ? { group: 'quote' as const, ...PRESS_PASSTHROUGH } : {})}
      position="relative"
      minHeight={QUOTE_THUMB_SIDE_PX}
      padding={QUOTE_INSET_PX}
      gap="$xs"
      borderRadius="$sm"
      overflow="hidden"
      {...(pressable ? { '$platform-web': { cursor: 'pointer' as const } } : {})}
    >
      <YStack
        position="absolute"
        top={0}
        bottom={0}
        left={0}
        right={0}
        backgroundColor={ink}
        opacity={onAccent ? QUOTE_TINT_OPACITY.outgoing : QUOTE_TINT_OPACITY.incoming}
      />
      {pressable ? (
        <StateLayer group="quote" tone="ink" borderRadius="$sm" pressed={pressed} />
      ) : null}
      <QuoteLines
        heading={author}
        preview={preview}
        ink={ink}
        secondary={{ color: ink, opacity: ON_ACCENT_SECONDARY_OPACITY }}
        stripe={onAccent ? '$onAccent' : '$primaryColor'}
        summaryLines={2}
      />
      <QuoteThumb
        visual={preview.visual}
        sidePx={QUOTE_THUMB_SIDE_PX}
        ink={ink}
        busy={busy}
        testID={thumbnailTestID}
      />
    </XStack>
  )
}

/**
 * The message a reply quotes, at the top of the reply's bubble: one press target that jumps to
 * the original, named "{author}: {summary}" for a screen reader, the picture's words included.
 */
export function MessageQuote({
  author,
  message,
  labels,
  onAccent,
  onPress,
  hint,
  busy = false,
  thumbnailTestID,
  testID,
}: MessageQuoteProps) {
  const preview = quotePreview(message, labels)
  const name = quoteAccessibleName(author, preview)
  const shared = { author, preview, onAccent, busy, thumbnailTestID }

  if (preview.found && onPress !== undefined)
    return (
      <PressArea
        onPress={onPress}
        accessibilityLabel={name}
        accessibilityHint={hint}
        busy={busy}
        ring={{ onAccent, offset: 2, radius: '$sm' }}
        {...(testID === undefined ? {} : { testID })}
      >
        {(pressed) => <QuoteBody {...shared} pressable pressed={pressed} />}
      </PressArea>
    )

  return (
    <YStack
      onPress={onPress}
      // One element on native, as the button is; on the web its words are read where they stand.
      {...(isWeb ? {} : { accessible: true, 'aria-label': name })}
      testID={testID}
    >
      <QuoteBody {...shared} pressable={false} />
    </YStack>
  )
}
