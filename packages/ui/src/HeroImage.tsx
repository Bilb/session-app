/* eslint-disable @typescript-eslint/triple-slash-reference --
   A path reference rather than an import, deliberately. These are ambient declarations for the
   bundlers' asset imports, and an `import` of a `.d.ts` is not a thing. Without the reference the
   declarations reach this package's own program and no other, so every consumer that typechecks
   these sources -- screens and both apps -- fails on the .png and .ttf imports below. */
/// <reference path="./assets.d.ts" />
import { Image } from 'react-native'
import { YStack } from 'tamagui'

import heroSource from '../assets/onboarding-hero.png'

/**
 * The two bundlers hand back different things for the same import, and `Image` takes both.
 *
 * Vite emits the file and returns its URL as a string, which has to be wrapped as `{ uri }`. Metro
 * registers it and returns an opaque asset id, which `Image` takes as-is. Checking the type is the
 * only way to tell them apart, and it is checked rather than assumed because getting it wrong
 * renders an `<img>` with no `src` -- an element of exactly the right size showing nothing.
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
    // `position="relative"` is load-bearing: react-native makes every view a containing block, but
    // the web does not, so without it the absolutely-positioned image resolves against the viewport
    // and covers the whole window.
    <YStack flex={1} position="relative" overflow="hidden">
      <Image
        source={source}
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          right: 0,
          // Height comes from top/bottom, width follows the artwork. A `minWidth` here would beat
          // the aspect ratio and fit the image to the column instead -- which shrinks it to show
          // the whole picture, and showing the whole picture is the opposite of a crop.
          aspectRatio: ASPECT,
        }}
        resizeMode="cover"
        alt=""
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
    </YStack>
  )
}
