import { getLocale, tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { ProgressRing, Text, useMedia, XStack, YStack } from '@session/ui'
import { useEffect, useRef, useState } from 'react'

import { OnboardingChrome } from './OnboardingChrome'

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

/** The desktop client's bar height. Much thicker than a hairline, and deliberately so. */
const BAR_HEIGHT = 17

interface LoadingScreenProps {
  onGaveUp: () => void
}

/**
 * The wait while a restored account's profile comes back from the swarm.
 *
 * **It is a step, not a takeover** -- inside the same chrome as every other one, so the artwork and
 * the Session lockup stay put and only the content changes. Replacing the whole screen was wrong:
 * the desktop client renders this stage inside the same registration column as the rest.
 *
 * **The indicator differs by design.** Desktop draws a thick horizontal bar with the percentage
 * beside the subtitle; both mobile clients draw a ring with no number. Same two strings on all
 * three.
 *
 * **It is a clock, not a measurement.** All three ramp to full over a fixed fifteen seconds with
 * nothing reporting real progress, and 2.0 keeps that knowingly rather than by imitation: what it
 * is really showing is how much longer this can go on before the app gives up.
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
  const percent = new Intl.NumberFormat(getLocale(), {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(fraction)

  return (
    <OnboardingChrome testID={ELEMENT.onboarding.loadingScreen}>
      {wide ? (
        <YStack>
          <Text size="$headingLarge" weight="bold" userSelect="none">
            {tr('waitOneMoment')}
          </Text>
          {/* Subtitle and percentage on one line, the client's arrangement: the number belongs
              with the thing it is counting rather than floating beside the bar. */}
          <XStack justifyContent="space-between" alignItems="center" gap="$1" paddingTop="$1.5">
            <Text size="$body">{tr('loadAccountProgressMessage')}</Text>
            <Text size="$body" fontVariant={['tabular-nums']} userSelect="none">
              {percent}
            </Text>
          </XStack>
          <YStack
            marginTop="$2.5"
            height={BAR_HEIGHT}
            borderRadius="$2"
            backgroundColor="$bordersColor"
            overflow="hidden"
          >
            <YStack
              width={`${String(Math.round(fraction * 100))}%`}
              height="100%"
              borderRadius="$2"
              backgroundColor="$primaryColor"
            />
          </YStack>
        </YStack>
      ) : (
        <YStack flex={1} alignItems="center" justifyContent="center" gap="$2">
          <ProgressRing progress={fraction} size={96} thickness={6} />
          <Text size="$titleLarge" weight="bold" textAlign="center">
            {tr('waitOneMoment')}
          </Text>
          <Text tone="secondary" textAlign="center">
            {tr('loadAccountProgressMessage')}
          </Text>
        </YStack>
      )}
    </OnboardingChrome>
  )
}
