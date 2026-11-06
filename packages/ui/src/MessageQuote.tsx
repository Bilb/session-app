import type { ReactNode } from 'react'
import { XStack, YStack } from 'tamagui'

import type { ElementId } from '@session/test-ids'

import { FileName } from './FileName'
import { ON_ACCENT_SECONDARY_OPACITY, type inkFor } from './ink'
import { PressArea } from './PressArea'
import { PRESS_PASSTHROUGH } from './pressPassthrough'
import {
  isQuotable,
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
 * square is the 44 pt target on its own, so the quote is never shorter than one.
 */
export const QUOTE_THUMB_SIDE_PX = 44
/** Legacy iOS's accent line: square-ended, so it reads as a rule rather than a pill. */
const STRIPE_WIDTH_PX = 4

/**
 * The stripe or the square, then the author and the summary: what the bar draws too. A quote of
 * an attachment leads with its square and no stripe, as legacy iOS draws it.
 */
export function QuoteLines({
  heading,
  preview,
  ink,
  secondary,
  stripe,
  summaryLines,
  thumb,
}: {
  /** The author, or the bar's "Replying to" with the author. */
  heading: string
  preview: QuotePreview
  ink: QuoteInk
  secondary: { color: QuoteInk | ReturnType<typeof inkFor>['color']; opacity: number }
  stripe: '$onAccent' | '$primaryColor'
  /** The quote wraps a body to two lines; the composer's bar holds every summary to one. */
  summaryLines: 1 | 2
  /** The picture or glyph, in the stripe's place, for a quote of an attachment. */
  thumb: ReactNode
}) {
  return (
    <>
      {preview.visual === null ? (
        <YStack width={STRIPE_WIDTH_PX} backgroundColor={stripe} />
      ) : null}
      {thumb}
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
  /** Absent or deleted: the original is not here, and nothing is drawn. */
  message: QuotedMessage | undefined
  labels: QuoteLabels
  /** Drawn on a bubble you sent. */
  onAccent: boolean
  /** Jumps to the original. Absent, the quote is no button. */
  onPress?: (() => void) | undefined
  /** Already worded, for what a press does, after the name. */
  hint?: string | undefined
  /** The original is being read in. */
  busy?: boolean | undefined
  /** Addresses the picture in the square, so a test can ask whether it arrived. */
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
      gap="$xs"
      borderRadius="$sm"
      overflow="hidden"
      {...(pressable ? { '$platform-web': { cursor: 'pointer' as const } } : {})}
    >
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
        thumb={
          <QuoteThumb
            visual={preview.visual}
            sidePx={QUOTE_THUMB_SIDE_PX}
            ink={ink}
            busy={busy}
            testID={thumbnailTestID}
          />
        }
      />
    </XStack>
  )
}

/**
 * The message a reply quotes, heading the reply's bubble inside its padding, with no box of its
 * own: one press target that jumps to the original, named "{author}: {summary}" for a screen
 * reader, the picture's words included. A reply whose original is not here draws no quote at all.
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
  if (!isQuotable(message)) return null
  const preview = quotePreview(message, labels)
  const shared = { author, preview, onAccent, busy, thumbnailTestID }

  if (onPress === undefined)
    return (
      <YStack testID={testID}>
        <QuoteBody {...shared} pressable={false} />
      </YStack>
    )

  return (
    <PressArea
      onPress={onPress}
      accessibilityLabel={quoteAccessibleName(author, preview)}
      accessibilityHint={hint}
      busy={busy}
      ring={{ onAccent, offset: 2, radius: '$sm' }}
      {...(testID === undefined ? {} : { testID })}
    >
      {(pressed) => <QuoteBody {...shared} pressable pressed={pressed} />}
    </PressArea>
  )
}
