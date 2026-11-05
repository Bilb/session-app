import type { Haptics } from '@session/ui'
import { ImpactFeedbackStyle, impactAsync } from 'expo-haptics'

/** A light impact, the weight both platforms' own swipe actions tap with. */
export const mobileHaptics: Haptics = {
  threshold: () => {
    void impactAsync(ImpactFeedbackStyle.Light)
  },
}
