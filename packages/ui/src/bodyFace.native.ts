import { Platform } from 'react-native'

import { drawnBodyFace, type Face } from './faceWeights'
import { FONT_ASSETS } from './fontAssets'

/** The face the body font's family resolves to on this platform. See `drawnBodyFace`. */
export const BODY_FACE: Face = drawnBodyFace(Platform.OS, FONT_ASSETS)
