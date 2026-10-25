import {
  logical,
  PaneSurfaceProvider,
  useMedia,
  usePageZoom,
  useTokenColor,
  XStack,
  YStack,
} from '@session/ui'
import type { ReactNode } from 'react'

import { PaneProvider, RailProvider } from './pane'
import { DETAIL_PANE, LIST_BESIDE_RAIL_PANE, LIST_PANE, SOLE_PANE } from './panes'

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
  rail,
}: {
  list: ReactNode
  detail: ReactNode
  hasDetail: boolean
  placeholder?: ReactNode
  /**
   * The column drawn at the start edge, before the list, whenever the list and the detail are
   * side by side: the desktop window and a tablet alike. Not on one pane, where the list's own
   * header holds what the rail would.
   */
  rail?: ReactNode
}) {
  const media = useMedia()
  const zoom = usePageZoom()
  const rule = useTokenColor('$bordersColor')
  const twoPanes = media.gtSm
  const showsList = twoPanes || !hasDetail
  const showsDetail = twoPanes || hasDetail

  // **One tree for both layouts**, the detail pane always the same element in the same place. A
  // second tree for one pane would remount whatever the detail holds whenever the window crosses
  // the breakpoint -- on mobile that is the router's `Slot`, which forgets the open conversation
  // when it remounts, so turning a tablet would close it. The list pane comes and goes beside it;
  // the detail pane is only hidden, never unmounted.
  const withRail = twoPanes && rail !== undefined
  return (
    <XStack flex={1} backgroundColor="$backgroundPrimary">
      {withRail ? (
        // Raised, so a tooltip opening from it lies over the list rather than under it: the list
        // comes later in the page and would otherwise paint on top.
        <YStack key="rail" position="relative" zIndex={1}>
          <PaneSurfaceProvider value="$backgroundSecondary">{rail}</PaneSurfaceProvider>
        </YStack>
      ) : null}
      {showsList ? (
        <YStack
          key="list"
          {...(twoPanes
            ? {
                // The window's, not the content's: divided by the desktop zoom so the list keeps
                // its share of the window however far the content is zoomed.
                width: (media.gtLg ? 380 : 320) / zoom,
                // The rule between the two panes sits on the edge the list ends at, which in
                // Arabic is its left: a physical right keeps the divider on the detail pane's outer
                // edge and leaves the two panes touching.
                ...logical({ borderEndWidth: 1, borderEndColor: rule }),
              }
            : { flex: 1 })}
        >
          {/* Recessed beside the detail, so the two read as separate panes; on its own the list
              is the page. */}
          <PaneSurfaceProvider value={twoPanes ? '$backgroundSecondary' : '$backgroundPrimary'}>
            <RailProvider value={withRail}>
              <PaneProvider
                value={withRail ? LIST_BESIDE_RAIL_PANE : twoPanes ? LIST_PANE : SOLE_PANE}
              >
                {list}
              </PaneProvider>
            </RailProvider>
          </PaneSurfaceProvider>
        </YStack>
      ) : null}
      <YStack key="detail" flex={1} display={showsDetail ? 'flex' : 'none'}>
        <PaneProvider value={twoPanes ? DETAIL_PANE : SOLE_PANE}>
          {hasDetail ? detail : placeholder}
        </PaneProvider>
      </YStack>
    </XStack>
  )
}
