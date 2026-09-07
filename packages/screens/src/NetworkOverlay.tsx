import { requirePorts } from '@session/app'
import { ELEMENT } from '@session/test-ids'
import { Text, XStack } from '@session/ui'
import type { ReactNode } from 'react'

import { shouldStampNetwork } from './networkStamp'

/**
 * Says which network this build is on, across whatever it wraps, and only when that is worth
 * saying.
 *
 * A port of what iOS does to its nav bar logo (`NavBarSessionIcon`): on anything but mainnet it
 * lays a rotated label over the title. The angle is the point - it reads as a stamp across the
 * thing rather than as a word beside it, so nobody mistakes a devnet build for a real one, and it
 * costs no layout, because a build that is on mainnet renders the children and nothing else.
 *
 * **Mainnet renders nothing extra, and that is the normal case.** Today it is the only case: the
 * shim refuses devnet until it can be handed seed nodes, and nothing sets testnet on mobile. The
 * seam is here so that whatever wires devnet up has somewhere to arrive, rather than this being
 * designed under time pressure later. See docs/STATUS.md.
 */
export function NetworkOverlay({ children }: { children: ReactNode }) {
  const network = requirePorts().network.name
  if (!shouldStampNetwork(network)) return <>{children}</>

  return (
    <XStack alignItems="center" justifyContent="center">
      {children}
      {/* Out of the flow, so the title underneath keeps the position and size it would have had:
          a badge that moved the header would be a badge that changes what is being tested. */}
      <XStack
        position="absolute"
        alignItems="center"
        justifyContent="center"
        rotate="-30deg"
        // iOS strokes the text against the background to keep it legible over the logo. React
        // Native has no text stroke, so this is the same idea with a chip: the label carries its
        // own contrast rather than depending on whatever it happens to sit on.
        backgroundColor="$backgroundPrimary"
        borderColor="$textPrimary"
        borderWidth={1}
        borderRadius="$1"
        paddingHorizontal="$1"
        opacity={0.92}
        pointerEvents="none"
        testID={ELEMENT.networkOverlay.badge}
      >
        <Text size="$2" weight="bold" color="$textPrimary">
          {network}
        </Text>
      </XStack>
    </XStack>
  )
}
