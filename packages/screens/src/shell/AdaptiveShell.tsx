import { logical, useMedia, XStack, YStack } from '@session/ui'
import type { ReactNode } from 'react'

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

  if (media.gtSm) {
    return (
      <XStack flex={1} backgroundColor="$backgroundPrimary">
        <YStack
          width={media.gtLg ? 380 : 320}
          // The rule between the two panes sits on the edge the list ends at, which in Arabic is
          // its left: a physical right keeps the divider on the detail pane's outer edge and
          // leaves the two panes touching.
          {...logical({ borderEndWidth: 1, borderEndColor: '$bordersColor' })}
        >
          {list}
        </YStack>
        <YStack flex={1}>{hasDetail ? detail : placeholder}</YStack>
      </XStack>
    )
  }

  return (
    <YStack flex={1} backgroundColor="$backgroundPrimary">
      {hasDetail ? detail : list}
    </YStack>
  )
}
