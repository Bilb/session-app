import { getLocale, tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { ProgressRing, Screen, Text, useMedia, XStack, YStack } from '@session/ui'
import { useEffect, useRef, useState } from 'react'

/**
 * How long to wait for a restored profile before giving up and asking for a name.
 *
 * The legacy clients' `TIMEOUT_TIME`. Not a guess at how long a swarm takes: it is the point at
 * which continuing to wait is worse than moving on, since the account already exists either way
 * and only its name is outstanding.
 */
const RESTORE_TIMEOUT_MS = 15_000

/** How often the indicator moves. Twenty-five frames a second is smooth and costs nothing. */
const TICK_MS = 40

interface LoadingScreenProps {
  onGaveUp: () => void
}

/**
 * The wait while a restored account's profile comes back from the swarm.
 *
 * **The indicator differs by design, like everything else here.** The desktop client draws a
 * horizontal bar with the percentage beside it; both mobile clients draw a ring with no number.
 * Same two strings on all three.
 *
 * **It is a clock, not a measurement.** All three ramp to full over a fixed fifteen seconds with
 * nothing reporting real progress, and 2.0 keeps that knowingly rather than by imitation: what it
 * is really showing is how much longer this can go on before the app gives up, which is the
 * question being asked while looking at it.
 */
export function LoadingScreen({ onGaveUp }: LoadingScreenProps) {
  const wide = useMedia().gtSm
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
      <YStack
        flex={1}
        alignItems="center"
        justifyContent="center"
        gap="$2"
        maxWidth={360}
        alignSelf="center"
      >
        {wide ? (
          <ProgressBar fraction={fraction} />
        ) : (
          <ProgressRing progress={fraction} size={96} thickness={6} />
        )}
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

/**
 * The desktop shape: a bar with the percentage beside it.
 *
 * The number is formatted rather than concatenated, because where the per-cent sign goes and
 * whether there is a space before it are both per-language. `Intl.NumberFormat` is one of the three
 * `Intl` constructors Hermes actually ships, so this works on a phone too -- which matters, because
 * a tablet in landscape draws this.
 */
function ProgressBar({ fraction }: { fraction: number }) {
  const percent = new Intl.NumberFormat(getLocale(), {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(fraction)

  return (
    <XStack width="100%" alignItems="center" gap="$1.5">
      <YStack
        flex={1}
        height={6}
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
      {/* Tabular figures, so the bar does not shift sideways as the number grows a digit. */}
      <Text size="$label" tone="secondary" fontVariant={['tabular-nums']}>
        {percent}
      </Text>
    </XStack>
  )
}
