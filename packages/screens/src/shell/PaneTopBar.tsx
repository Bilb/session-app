import { BarRule, XStack } from '@session/ui'
import type { ReactNode } from 'react'

import { useBesideList, useTopBarInsets } from './pane'

/**
 * The bar's row height: a 44-point control, the smallest touch target, is the tallest thing either
 * pane's bar holds. A floor rather than what each bar's content happens to measure, so the list's
 * bar and the conversation's beside it are always the same height and their rules meet.
 */
const ROW_MIN_HEIGHT_PX = 44

/**
 * A centred bar's ends share what the title leaves, so with no floor a long title squeezes them to
 * nothing and runs under their controls. Each end holds one 44-point control at most; one that
 * holds two needs this doubled.
 */
const END_MIN_WIDTH_PX = 44

/**
 * A pane's top bar and the rule under it (on the desktop only, as `BarRule` says), shared by the
 * list and the conversation so the two read as one bar across the window.
 *
 * Beside the list a pane's bar takes the list's recessed surface, as the current desktop app's bars
 * do; on its own a pane is the page, and so is its bar.
 *
 * `centred` puts the title in the middle of the bar whatever the two ends hold: they share what's
 * left equally, so a back button on one side and an avatar on the other don't pull it off centre.
 */
export function PaneTopBar({
  leading,
  title,
  trailing,
  centred = false,
  testID,
}: {
  leading?: ReactNode | undefined
  title: ReactNode
  trailing?: ReactNode | undefined
  centred?: boolean | undefined
  testID?: string | undefined
}) {
  const topBarInsets = useTopBarInsets()
  const besideList = useBesideList()

  return (
    <>
      <XStack
        paddingHorizontal="$md"
        paddingVertical="$sm"
        {...(besideList ? { backgroundColor: '$backgroundSecondary' } : {})}
        testID={testID}
        {...topBarInsets}
      >
        <XStack flex={1} minHeight={ROW_MIN_HEIGHT_PX} gap="$sm" alignItems="center">
          {centred ? (
            <>
              <XStack
                flex={1}
                flexBasis={0}
                minWidth={END_MIN_WIDTH_PX}
                alignItems="center"
                gap="$xs"
              >
                {leading}
              </XStack>
              {/* Shrinks first, so a long name truncates rather than pushing either end off. */}
              <XStack flexShrink={1} justifyContent="center">
                {title}
              </XStack>
              <XStack
                flex={1}
                flexBasis={0}
                minWidth={END_MIN_WIDTH_PX}
                alignItems="center"
                justifyContent="flex-end"
                gap="$xs"
              >
                {trailing}
              </XStack>
            </>
          ) : (
            <>
              {/* Shrinks first, so that at a large text size the title wraps rather than pushing
                  the controls after it off the edge. */}
              <XStack alignItems="center" gap="$xs" flexShrink={1}>
                {leading}
                {title}
              </XStack>
              <XStack flex={1} alignItems="center" justifyContent="flex-end" gap="$sm">
                {trailing}
              </XStack>
            </>
          )}
        </XStack>
      </XStack>

      <BarRule />
    </>
  )
}
