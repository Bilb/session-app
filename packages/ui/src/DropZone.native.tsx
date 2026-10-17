import { YStack } from 'tamagui'

import type { DropZoneProps } from './DropZone.types'

export type { DropZoneProps }

/** Nothing is dropped on a phone or a tablet here yet; the zone only lays out what it wraps. */
export function DropZone({ children }: DropZoneProps) {
  return (
    <YStack flex={1} position="relative">
      {children}
    </YStack>
  )
}
