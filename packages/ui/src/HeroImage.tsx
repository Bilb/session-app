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
    // the web does not, so without it the absolutely-positioned artwork resolves against the
    // viewport and covers the whole window.
    <YStack flex={1} position="relative" overflow="hidden">
      {/**
       * **The aspect ratio goes on this box, not on the image inside it.**
       *
       * An `Image` measures itself from its source and that measurement wins, so `aspectRatio` on
       * the image is silently ignored on native -- asked for a full-height box at the artwork's
       * proportions it returned one 1629 wide, the file's pixel width, since an asset with no
       * `@2x` suffix is a 1x asset. With all four insets instead it returned 1629x2160 and
       * overflowed the panel in both directions: enlarged past its own resolution, cropped on
       * three sides, showing a quarter of its width. The same styles were correct on the web
       * throughout, which is why this only showed up on a device.
       *
       * A plain view has no such measurement, so the ratio resolves. Measured on an iPad, asking
       * three ways at once: view 913x1210, image 1629x1210, image with insets 1629x2160.
       */}
      <YStack position="absolute" top={0} right={0} height="100%" aspectRatio={ASPECT}>
        {/* Percentages, so the image takes the box rather than describing one. A `minWidth`
            anywhere here would fit the artwork to the panel instead -- which shrinks it to show
            the whole picture, and showing the whole picture is the opposite of a crop. */}
        <Image
          source={source}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
          alt=""
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      </YStack>
    </YStack>
  )
}
