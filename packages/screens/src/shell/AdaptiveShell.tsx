import { logical, useMedia, useTokenColor, XStack, YStack } from '@session/ui'
import type { ReactNode } from 'react'

import { PaneProvider } from './pane'
import { DETAIL_PANE, LIST_PANE, SOLE_PANE } from './panes'

/**
 * One list, one detail, and the decision about how many of them fit.
 *
 * This is the only place that decides whether the app is showing one pane or two. Phones
 * and narrow windows get a single pane and lean on the router's back; anything wider keeps
 * the list beside the detail. The routes are identical either way - only what is drawn
 * changes - so a link, a notification tap and the back button all behave the same on every
 * device.
 */
export function AdaptiveShell({
  list,
  detail,
  hasDetail,
  placeholder,
}: {
  list: ReactNode
  detail: ReactNode
  hasDetail: boolean
  placeholder?: ReactNode
}) {
  const media = useMedia()
  const rule = useTokenColor('$bordersColor')

  if (media.gtSm) {
    return (
      <XStack flex={1} backgroundColor="$backgroundPrimary">
        <YStack
          width={media.gtLg ? 380 : 320}
          // The rule between the two panes sits on the edge the list ends at, which in Arabic is
          // its left: a physical right keeps the divider on the detail pane's outer edge and
          // leaves the two panes touching.
          {...logical({ borderEndWidth: 1, borderEndColor: rule })}
        >
          <PaneProvider value={LIST_PANE}>{list}</PaneProvider>
        </YStack>
        <YStack flex={1}>
          <PaneProvider value={DETAIL_PANE}>{hasDetail ? detail : placeholder}</PaneProvider>
        </YStack>
      </XStack>
    )
  }

  return (
    <YStack flex={1} backgroundColor="$backgroundPrimary">
      <PaneProvider value={SOLE_PANE}>{hasDetail ? detail : list}</PaneProvider>
    </YStack>
  )
}
