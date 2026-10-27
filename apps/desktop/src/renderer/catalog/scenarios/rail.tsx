import { ActionRail } from '@session/screens'
import { PaneSurfaceProvider, YStack } from '@session/ui'
import { defineStory, type AnyStory } from '@session/ui/catalog'

/** The rail's own width, so the border down its end edge sits at the cell's. */
const RAIL_WIDTH = 80

/** Tall enough to show the gap the rail opens between the account and the status items. */
const RAIL_HEIGHT = 360

/**
 * The rail as a wide layout draws it, on the recessed surface. A right-to-left page moves its
 * border to the other edge, and an accent recolours the settings badge and the focus ring.
 */
export const RAIL_SCENARIOS: readonly AnyStory[] = [
  defineStory<Record<string, never>>({
    component: 'rail',
    story: 'items',
    width: RAIL_WIDTH,
    sensitive: { accent: true, rtl: true },
    variants: { resting: {} },
    render: () => (
      <PaneSurfaceProvider value="$backgroundSecondary">
        <YStack height={RAIL_HEIGHT}>
          <ActionRail />
        </YStack>
      </PaneSurfaceProvider>
    ),
  }),
]
