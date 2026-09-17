import { requirePorts } from '@session/app'
import { ELEMENT } from '@session/test-ids'
import { Text, XStack } from '@session/ui'
import type { ReactNode } from 'react'

import { networkStampLabel } from './networkStamp'

/**
 * Lays a rotated label over whatever it wraps on any build that is not mainnet. The rotation
 * carries the meaning: it reads as a mark across the title rather than a word beside it, so a
 * devnet build is not mistaken for a real one.
 *
 * Mainnet renders the children and nothing else, so a real build pays no layout for this. Nothing
 * reaches the other branch yet - devnet stays unreachable until the shim can be handed seed nodes
 * (docs/STATUS.md) - so treat it as untested against a real network.
 */
export function NetworkOverlay({ children }: { children: ReactNode }) {
  const { name, usingFake } = requirePorts().network
  const label = networkStampLabel(name, usingFake)
  if (label === null) return <>{children}</>

  return (
    // `relative`: the badge below is placed against this box, not the page. See TopTabs.
    <XStack position="relative" alignItems="center" justifyContent="center">
      {children}
      {/* Out of the flow, so the title underneath keeps the position and size it would have had.
          A badge that shifted the header would change the layout a test is asserting on. */}
      <XStack
        position="absolute"
        alignItems="center"
        justifyContent="center"
        rotate="-30deg"
        // The label sits over arbitrary content, and React Native has no text stroke to separate
        // it from what is underneath, so the chip carries its own contrast instead.
        backgroundColor="$backgroundPrimary"
        borderColor="$textPrimary"
        borderWidth={1}
        borderRadius="$sm"
        paddingHorizontal="$xs"
        opacity={0.92}
        pointerEvents="none"
        testID={ELEMENT.networkOverlay.badge}
      >
        <Text size="$caption" weight="bold" color="$textPrimary">
          {label}
        </Text>
      </XStack>
    </XStack>
  )
}
