/* eslint-disable @typescript-eslint/triple-slash-reference --
   The asset declarations reach consumers only through a path reference. See tamaguiCSS.ts. */
/// <reference path="./assets.d.ts" />
import robotoBold from '../assets/fonts/Roboto-Bold.ttf'
import robotoMedium from '../assets/fonts/Roboto-Medium.ttf'
import robotoRegular from '../assets/fonts/Roboto-Regular.ttf'
import robotoMono from '../assets/fonts/RobotoMono-VariableFont_wght.ttf'

import type { FontAssets } from './fontAssets.types'

/** One face the desktop ships, which `tamaguiCSS.ts` declares as an `@font-face` rule. */
export interface BundledFace {
  family: string
  /** One weight, or a variable file's range. */
  weight: string
  src: string
}

/**
 * The faces the desktop bundles. The phones' are in `fontAssets.native.ts`.
 *
 * Roboto, shipped rather than assumed: it is the face the desktop client uses, and it is not
 * installed on macOS or on most Windows machines, so naming it in the font stack without shipping it
 * falls through to the platform's default, which is how this app was drawing a serif. Three weights,
 * because the type scale asks for regular, semibold and bold and nothing else. Roboto Mono, for the
 * account ID, is one variable file, so one rule covers its range.
 *
 * Two lists rather than one because Metro bundles every file a module it loads imports: listing
 * these for the phones would ship three Roboto files that Android already has and iOS does not draw.
 */
export const BUNDLED_FACES: readonly BundledFace[] = [
  { family: 'Roboto', weight: '400', src: robotoRegular },
  { family: 'Roboto', weight: '500', src: robotoMedium },
  { family: 'Roboto', weight: '700', src: robotoBold },
  { family: 'Roboto Mono', weight: '100 700', src: robotoMono },
]

/** Nothing to register at runtime on the desktop: the stylesheet loads every face above. */
export const FONT_ASSETS: FontAssets = {}
