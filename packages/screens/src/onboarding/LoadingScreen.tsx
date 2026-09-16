import { getLocale, tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { ProgressRing, Screen, Text, useMedia, useWindowSize, XStack, YStack } from '@session/ui'
import { useEffect, useRef, useState } from 'react'

import { OnboardingBackButton, WideBackButton } from './OnboardingBackButton'
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

/**
 * The phone ring.
 *
 * Both mobile clients draw something much larger than an ordinary spinner -- iOS pads it by its
 * `massiveSpacing` on each side, so it spans most of the width -- because on a phone this is the
 * whole screen rather than one element on it.
 */
/**
 * How much of the width the gauge leaves either side.
 *
 * **Two insets, not one, because the client nests them**: the column takes
 * `.padding(.horizontal, Values.veryLargeSpacing)` (35) and the gauge inside it takes another
 * `.padding(.horizontal, Values.massiveSpacing)` (64). Reading only the inner one made the ring
 * two thirds of a phone's width rather than half of it -- large enough to look wrong in the other
 * direction, which is what a fixed 160 had been.
 *
 * The size follows from these rather than being a number of its own, which is what the client
 * does, and why it reads as filling the screen without touching the edges.
 */
const COLUMN_INSET = 35
const GAUGE_INSET = 64
const RING_INSET = COLUMN_INSET + GAUGE_INSET

/**
 * The ring's stroke. **The legacy client's own number**, and ours was under half of it.
 *
 * iOS draws this gauge with `StrokeStyle(lineWidth: 20, lineCap: .round)`. At 8 it read as a thin
 * progress ring rather than as the heavy gauge the client shows, which is the difference that
 * was reported. The round cap we already had; only the weight was wrong.
 */
const RING_THICKNESS = 20

interface LoadingScreenProps {
  onGaveUp: () => void
  /**
   * Leaving the wait, which throws the restored account away.
   *
   * The legacy Android client offers this, and without it a mistyped phrase means fifteen seconds
   * of sitting there. Safe to offer because backing out of a restore already discards -- see
   * `backDiscardsAccount`.
   */
  onBack: () => void
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
export function LoadingScreen({ onGaveUp, onBack }: LoadingScreenProps) {
  const wide = useMedia().gtSm
  const window = useWindowSize()
  const ringSize = Math.max(160, window.width - RING_INSET * 2)
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

  // **The phone loader takes over the screen; the desktop one is a step.** Both mobile clients draw
  // this over the whole background with nothing else on it -- iOS's ignores the safe area to do it
  // -- where the desktop client renders it inside the same registration column as every other
  // stage. So this is the one step that is not always inside the chrome.
  if (!wide) {
    return (
      <Screen testID={ELEMENT.onboarding.loadingScreen}>
        <XStack alignItems="center" minHeight="$7" paddingHorizontal="$2" paddingTop="$1">
          <OnboardingBackButton onPress={onBack} />
        </XStack>
        <YStack flex={1} alignItems="center" justifyContent="center" gap="$2" padding="$3">
          {/* The number sits **inside** the ring on both clients -- iOS overlays it, Android
              centres it in the arc -- rather than beside it as the desktop bar does. */}
          <YStack
            width={ringSize}
            height={ringSize}
            position="relative"
            alignItems="center"
            justifyContent="center"
          >
            <ProgressRing progress={fraction} size={ringSize} thickness={RING_THICKNESS} />
            <YStack fullscreen alignItems="center" justifyContent="center" pointerEvents="none">
              {/* 32, the size Android draws this at; iOS's is 33. Ours reached past the rung to
                  36 because the ladder was missing it. */}
              <Text size="$displayMedium" weight="bold" fontVariant={['tabular-nums']}>
                {percent}
              </Text>
            </YStack>
          </YStack>
          {/* 18 on Android, 19 on iOS. Ours was 20. */}
          <Text size="$title" weight="bold" textAlign="center">
            {tr('waitOneMoment')}
          </Text>
          <Text textAlign="center">{tr('loadAccountProgressMessage')}</Text>
        </YStack>
      </Screen>
    )
  }

  return (
    <OnboardingChrome testID={ELEMENT.onboarding.loadingScreen}>
      {/* **The way back, which the wide layout did not have.** Both mobile clients put a chevron
          on this screen and neither asks anything when it is pressed -- it returns to the step
          before, and that is what the phone layout above already does. This one had none at all,
          because it is the one step that does not go through `OnboardingStep` and so nothing was
          in a position to draw it. The hanger is the same one every other wide step uses. */}
      <XStack>
        <WideBackButton onPress={onBack} />
        <YStack flex={1}>
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
      </XStack>
    </OnboardingChrome>
  )
}
