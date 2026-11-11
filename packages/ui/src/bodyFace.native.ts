import { Platform } from 'react-native'

import { drawnBodyFace, type BodyFontFaces, type Face } from './faceWeights'
import { FONT_ASSETS } from './fontAssets'

/**
 * The system family Android needs for each body weight it would otherwise lose.
 *
 * **Android keeps a weight only when no family is named.** Given one, react-native reduces the
 * weight to regular or bold (`ReactFontManager`'s `nearestStyle`: anything under 700 is regular),
 * and the body font names a family. So semibold, Roboto's 500, drew as regular there. Android
 * ships Roboto Medium as `sans-serif-medium`, which is the family 500 is given instead. Bold needs
 * nothing: 700 survives the reduction.
 */
const ANDROID_BODY_FACES = { 500: { normal: 'sans-serif-medium' } } as const

/** The face the body font's family resolves to on this platform. See `drawnBodyFace`. */
export const BODY_FACE: Face = drawnBodyFace(Platform.OS, FONT_ASSETS)

/** The body font's faces by weight. See `ANDROID_BODY_FACES`. */
export const BODY_FONT_FACES: BodyFontFaces = Platform.OS === 'android' ? ANDROID_BODY_FACES : {}
