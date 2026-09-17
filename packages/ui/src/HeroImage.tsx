/* eslint-disable @typescript-eslint/triple-slash-reference --
   A path reference rather than an import, deliberately. These are ambient declarations for the
   bundlers' asset imports, and an `import` of a `.d.ts` is not a thing. Without the reference the
   declarations reach this package's own program and no other, so every consumer that typechecks
   these sources -- screens and both apps -- fails on the .png and .ttf imports below. */
/// <reference path="./assets.d.ts" />
import { Image } from 'react-native'
import { XStack, YStack } from 'tamagui'

import heroSource from '../assets/onboarding-hero.png'

/**
 * The two bundlers hand back different things for the same import, and `Image` takes both.
 *
 * Vite returns a URL string, which has to be wrapped as `{ uri }`; Metro returns an opaque asset
 * id, which `Image` takes as-is. Getting it wrong renders an element of exactly the right size
 * showing nothing, so the type is checked rather than assumed.
 */
const source = typeof heroSource === 'string' ? { uri: heroSource } : heroSource

/** The artwork's own proportions, so the crop can be anchored rather than centred. */
const ASPECT = 1629 / 2160

/**
 * The artwork down one side of the desktop onboarding.
 *
 * **Anchored to its right edge**, which is the desktop client's rule -- `object-position: right
 * center`. The subject sits on the right of a tall arrangement of phones, so a centred crop takes
 * a slice out of the middle and loses it.
 *
 * `resizeMode="cover"` cannot do that: it centres, and react-native has no `object-position`. So
 * the image is sized from its own aspect ratio, pinned to the right of a clipping container, and
 * allowed to overflow to the left -- which is what anchoring a crop actually means, and works the
 * same on both platforms rather than only in a browser.
 */
export function HeroImage() {
  return (
    // Aligned rather than absolutely positioned: an absolute child is laid out against the panel's
    // bounds rather than with them, so its edge lags during a resize and the clip appears on the
    // subject's side. A normal child aligned to the end overflows away from that edge.
    <XStack flex={1} overflow="hidden" justifyContent="flex-end">
      {/**
       * **The aspect ratio goes on this box, never on the `Image` inside it.** An `Image`
       * measures itself from its source and that measurement wins, so a ratio set on it is
       * silently ignored on native and the artwork comes out at the file's pixel size. A plain
       * view has no such measurement.
       *
       * **`flexGrow`/`flexShrink` rather than a percentage width.** The width follows from the
       * height and the artwork's proportions, which is wider than the panel in the ordinary case
       * -- the excess being the crop, which `flexShrink: 0` allows. On a wide, short window it
       * comes out narrower instead, and `flexGrow` closes the gap that would leave. A percentage
       * states the same rule but is resolved against the parent and cached, so it goes stale for
       * the length of a drag-resize; free space is recomputed every pass.
       */}
      <YStack alignSelf="stretch" flexGrow={1} flexShrink={0} aspectRatio={ASPECT}>
        {/* Percentages, so the image fills the box rather than describing one. A `minWidth` here
            would fit the artwork to the panel, which shows the whole picture -- the opposite of a
            crop. */}
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
