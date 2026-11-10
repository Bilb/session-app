import { useEffect, useState } from 'react'
import { AccessibilityInfo } from 'react-native'

/** The system's Reduce Motion, followed while mounted. False until the first answer arrives. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    let live = true
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (live) setReduced(enabled)
    })
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced)
    return () => {
      live = false
      subscription.remove()
    }
  }, [])
  return reduced
}
