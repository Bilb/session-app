/* eslint-disable @typescript-eslint/triple-slash-reference --
   Ambient declarations for the bundlers' asset imports, which an `import` cannot reach. Without
   the reference they stay inside this package and every consumer fails on the .png import. */
/// <reference path="./assets.d.ts" />
import { Image } from 'react-native'
import { XStack, YStack } from 'tamagui'

import heroSource from '../assets/onboarding-hero.png'

/** Vite returns a URL string and Metro an opaque asset id. `Image` takes either, spelled this way. */
const source = typeof heroSource === 'string' ? { uri: heroSource } : heroSource

const ASPECT = 1629 / 2160

/**
 * The artwork down one side of the desktop onboarding, cropped from its trailing edge.
 *
 * `resizeMode="cover"` cannot anchor a crop -- it centres, and react-native has no
 * `object-position` -- so the image is sized from its own ratio, aligned to the end of a clipping
 * box, and allowed to overflow away from that edge.
 *
 * Three things here look arbitrary and are not. The ratio is on the box because an `Image`
 * measures itself from its source and that measurement wins. Alignment rather than absolute
 * positioning, because an absolute child lays out against the panel's bounds rather than with
 * them and lags a resize. Flex rather than a percentage width, because a percentage resolves
 * against the parent once and is cached, so it goes stale mid-resize.
 */
export function HeroImage() {
  return (
    <XStack flex={1} overflow="hidden" justifyContent="flex-end">
      <YStack alignSelf="stretch" flexGrow={1} flexShrink={0} aspectRatio={ASPECT}>
        <Image
          source={source}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
          alt=""
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      </YStack>
    </XStack>
  )
}
