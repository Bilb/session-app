import { Platform } from 'react-native'

import type { Face } from './faceWeights'

/**
 * The face the body font's family resolves to on this platform.
 *
 * The family names Roboto first. Android has it system-wide; iOS has no Roboto unless the app
 * bundles one, and draws San Francisco in its place. **If Roboto is ever bundled for iOS, this has
 * to say so**, or `Text` keeps asking for San Francisco's weights from a face that is not drawn.
 */
export const BODY_FACE: Face = Platform.OS === 'ios' ? 'sanFrancisco' : 'roboto'
