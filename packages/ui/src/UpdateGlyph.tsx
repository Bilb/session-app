import type { ReactNode } from 'react'
import Svg, { Circle } from 'react-native-svg'
import { YStack } from 'tamagui'

import { Icon } from './Icon'
import { ProgressRing, TRANSFER_RING_SIDE_PX, TRANSFER_RING_THICKNESS } from './ProgressRing'
import { Text } from './Text'
import type { UpdateStatus } from './UpdateIndicator.types'
import { useTokenColor } from './useTokenColor'

const SIDE_PX = TRANSFER_RING_SIDE_PX
const GLYPH_PX = 14
/** The error glyph has no ring around it, so it takes the room the ring would. */
const ALERT_GLYPH_PX = 20
/** How many dots the available ring is drawn with. */
const DOTS = 12

/**
 * A full circle round the glyph, in the transfer ring's size and stroke so that the states line up
 * as one control changing: dotted while an update merely exists, solid once it is ready.
 */
function Ring({ dotted, color }: { dotted: boolean; color: string }) {
  const stroke = useTokenColor(color)
  const radius = (SIDE_PX - TRANSFER_RING_THICKNESS) / 2
  const gap = (2 * Math.PI * radius) / DOTS
  return (
    <Svg
      width={SIDE_PX}
      height={SIDE_PX}
      viewBox={`0 0 ${String(SIDE_PX)} ${String(SIDE_PX)}`}
      style={{ position: 'absolute' }}
    >
      <Circle
        cx={SIDE_PX / 2}
        cy={SIDE_PX / 2}
        r={radius}
        stroke={stroke}
        strokeWidth={TRANSFER_RING_THICKNESS}
        fill="none"
        // A dash of almost nothing with round caps is a dot the stroke's width across.
        {...(dotted ? { strokeDasharray: `0.01 ${String(gap)}`, strokeLinecap: 'round' } : {})}
      />
    </Svg>
  )
}

/** The square every state is drawn in, holding the ring placed over it. */
function Frame({ children }: { children: ReactNode }) {
  return (
    <YStack
      width={SIDE_PX}
      height={SIDE_PX}
      alignItems="center"
      justifyContent="center"
      position="relative"
    >
      {children}
    </YStack>
  )
}

/**
 * One update state, drawn still. `UpdateIndicator` cross-fades between these.
 *
 * Told apart by glyph and ring rather than by colour, so that they read in a light theme as well as
 * a dark one: the glyph is the text colour, and only the progress and the ready ring take the
 * accent. An error is the one exception, in the danger colour, since it is the one that asks for
 * something to be done.
 */
export function UpdateGlyph({
  status,
  showPercent = false,
}: {
  status: UpdateStatus
  showPercent?: boolean | undefined
}) {
  switch (status.kind) {
    case 'available':
      return (
        <Frame>
          <Ring dotted color="$textSecondary" />
          <Icon name="cloudDownload" size={GLYPH_PX} color="$textPrimary" />
        </Frame>
      )
    case 'downloading':
      return (
        <Frame>
          <YStack position="absolute">
            <ProgressRing
              progress={status.progress}
              size={SIDE_PX}
              thickness={TRANSFER_RING_THICKNESS}
            />
          </YStack>
          {showPercent ? (
            <Text size="$caption" weight="bold" numberOfLines={1}>
              {String(Math.round(Math.min(1, Math.max(0, status.progress)) * 100))}
            </Text>
          ) : (
            <Icon name="download" size={GLYPH_PX} color="$textPrimary" />
          )}
        </Frame>
      )
    case 'ready':
      return (
        <Frame>
          <Ring dotted={false} color="$primaryColor" />
          <Icon name="packageCheck" size={GLYPH_PX} color="$textPrimary" />
        </Frame>
      )
    case 'error':
      return (
        <Frame>
          <Icon name="triangleAlert" size={ALERT_GLYPH_PX} color="$dangerColor" />
        </Frame>
      )
  }
}
