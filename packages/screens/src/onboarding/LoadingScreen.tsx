import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { Screen, Text, YStack } from '@session/ui'
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
 * **The bar is a clock, not a measurement**, which is how the legacy clients draw it too: nothing
 * downstream reports progress, so the only honest alternative would be an indeterminate spinner.
 * A bar that fills over the timeout at least tells somebody how much longer this can go on, which
 * is the question being asked while looking at it.
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
        <Text size="$headingLarge" weight="bold">
          {tr('waitOneMoment')}
        </Text>
        <Text tone="secondary" size="$body">
          {tr('loadAccountProgressMessage')}
        </Text>
        <YStack
          width="100%"
          maxWidth={320}
          height={4}
          borderRadius="$full"
          backgroundColor="$backgroundTertiary"
          overflow="hidden"
        >
          <YStack
            width={`${String(Math.round(fraction * 100))}%`}
            height="100%"
            backgroundColor="$primaryColor"
          />
        </YStack>
      </YStack>
    </Screen>
  )
}
