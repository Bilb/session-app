import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { ProgressRing, Screen, Text, YStack } from '@session/ui'
import { useEffect, useRef, useState } from 'react'

/**
 * How long to wait for a restored profile before giving up and asking for a name.
 *
 * The legacy clients' `TIMEOUT_TIME`. Not a guess at how long a swarm takes: it is the point at
 * which continuing to wait is worse than moving on, since the account already exists either way
 * and only its name is outstanding.
 */
const RESTORE_TIMEOUT_MS = 15_000

/** How often the bar moves. Twenty-five frames a second is smooth and costs nothing. */
const TICK_MS = 40

interface LoadingScreenProps {
  onGaveUp: () => void
}

/**
 * The wait while a restored account's profile comes back from the swarm.
 *
 * **The ring is a clock, not a measurement.** All three legacy clients do the same -- a fixed ramp
 * to 99% over fifteen seconds, with nothing downstream reporting real progress -- so this inherits
 * the shape knowingly rather than by imitation. The defence is that the number it is really showing
 * is how much longer this can go on before the app gives up, which is the question being asked
 * while looking at it. If that is not good enough, the honest alternative is an indeterminate
 * spinner, and that is a decision rather than a fix.
 */
export function LoadingScreen({ onGaveUp }: LoadingScreenProps) {
  const [elapsed, setElapsed] = useState(0)
  // Held in a ref so the interval's identity never depends on it: re-creating the timer on every
  // tick would drift, and clearing it in the cleanup would restart the wait.
  const gaveUp = useRef(onGaveUp)
  gaveUp.current = onGaveUp

  useEffect(() => {
    const started = Date.now()
    const timer = setInterval(() => {
      // Measured against the clock rather than counted in ticks, because a backgrounded app stops
      // getting them -- and coming back to a bar that had paused would say the wait had paused.
      const since = Date.now() - started
      setElapsed(since)
      if (since >= RESTORE_TIMEOUT_MS) {
        clearInterval(timer)
        gaveUp.current()
      }
    }, TICK_MS)
    return () => {
      clearInterval(timer)
    }
  }, [])

  const fraction = Math.min(1, elapsed / RESTORE_TIMEOUT_MS)

  return (
    <Screen padded testID={ELEMENT.onboarding.loadingScreen}>
      <YStack flex={1} alignItems="center" justifyContent="center" gap="$2">
        {/* A ring, because that is what both mobile clients draw here -- iOS's
            CircularProgressView and Android's ProgressArc -- alongside the same two strings. */}
        <ProgressRing progress={fraction} size={96} thickness={6} />
        <Text size="$titleLarge" weight="bold" textAlign="center">
          {tr('waitOneMoment')}
        </Text>
        <Text tone="secondary" textAlign="center">
          {tr('loadAccountProgressMessage')}
        </Text>
      </YStack>
    </Screen>
  )
}
