import { BarRule, Text, useScreenInsets, XStack, YStack } from '@session/ui'
import type { ReactNode } from 'react'

import { useBesideList, useTopBarInsets } from './pane'

/**
 * The height of every pane's top bar, inside its padding: the list's, the conversation's and the
 * requests'. One value rather than whatever each bar holds, so bars drawn side by side are the same
 * height and their rules meet. Text set larger than the default can still grow it.
 */
const BAR_HEIGHT_PX = 44

/**
 * A control in a pane's top bar: the 44-point target Apple asks for. A centred bar's ends each keep
 * room for one, so a long title truncates rather than running under them.
 */
export const BAR_CONTROL_SIZE_PX = 44

/** A pane's title, where it starts the bar rather than sitting centred in it. */
export function PaneTitle({ children }: { children: ReactNode }) {
  return (
    <Text size="$title" weight="bold">
      {children}
    </Text>
  )
}

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
  const { top } = useScreenInsets()

  return (
    <>
      <YStack
        {...(besideList
          ? {
              backgroundColor: '$backgroundSecondary',
              // The screen holds its content clear of the status bar with padding in the page's
              // colour. Reaching up into it carries the bar's colour behind the status bar on a
              // tablet, so the strip above the conversation matches the one above the list.
              marginTop: -top,
              paddingTop: top,
            }
          : {})}
      >
        <XStack paddingHorizontal="$md" paddingVertical="$sm" testID={testID} {...topBarInsets}>
          <XStack flex={1} minHeight={BAR_HEIGHT_PX} gap="$sm" alignItems="center">
            {centred ? (
              <>
                <XStack
                  flex={1}
                  flexBasis={0}
                  minWidth={BAR_CONTROL_SIZE_PX}
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
                  minWidth={BAR_CONTROL_SIZE_PX}
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
      </YStack>

      <BarRule />
    </>
  )
}
