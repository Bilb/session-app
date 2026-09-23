import { Platform } from 'react-native'

/**
 * Android's `DialogBg` border, or iOS's `Modal.swift` shadow: radius 10 at 0.4, no border at all.
 * See alertEdge.ts.
 */
export const ALERT_EDGE =
  Platform.OS === 'ios'
    ? ({
        shadowColor: '$shadow',
        shadowRadius: 10,
        shadowOpacity: 0.4,
        shadowOffset: { width: 0, height: 0 },
      } as const)
    : ({ borderWidth: 1, borderColor: '$bordersColor' } as const)
