/* eslint-disable @typescript-eslint/triple-slash-reference --
   A path reference rather than an import, deliberately. These are ambient declarations for the
   bundlers' asset imports, and an `import` of a `.d.ts` is not a thing. Without the reference the
   declarations reach this package's own program and no other, so every consumer that typechecks
   these sources -- screens and both apps -- fails on the .png and .ttf imports below. */
/// <reference path="./assets.d.ts" />
import { Image } from 'react-native'

import heroSource from '../assets/onboarding-hero.png'

/**
 * The two bundlers hand back different things for the same import, and `Image` takes both.
 *
 * Vite emits the file and returns its URL as a string, which has to be wrapped as `{ uri }`. Metro
 * registers it and returns an opaque asset id, which `Image` takes as-is. Checking the type is the
 * only way to tell them apart, and it is checked rather than assumed because getting it wrong
 * renders an `<img>` with no `src` -- an element of exactly the right size showing nothing, which
 * is what it did before this.
 */
const source = typeof heroSource === 'string' ? { uri: heroSource } : heroSource

/**
 * The artwork down one side of the desktop onboarding.
 *
 * Cropped rather than fitted -- `cover` with the right edge pinned, which is the desktop client's
 * own rule. The image is a tall arrangement of phones and the subject sits on its right-hand side,
 * so a centred crop loses it in a narrow column and `contain` would letterbox the whole thing to
 * show the empty left.
 */
export function HeroImage() {
  return (
    <Image
      source={source}
      style={{ width: '100%', height: '100%' }}
      resizeMode="cover"
      // The subject is on the right. react-native has no object-position, so the crop is steered
      // by the alignment of the resized image instead.
      alt=""
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  )
}
