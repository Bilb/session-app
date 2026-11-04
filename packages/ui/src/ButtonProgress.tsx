import { isWeb, YStack } from 'tamagui'

import { buttonHeight, type ButtonSize } from './buttonHitTarget'
import { ProgressRing } from './ProgressRing'
import type { WithTestID } from './with'

/** The ring's side as a share of the frame's: 20 in the footer's 32. */
const RING_SHARE = 5 / 8

/** The ring's thickness as a share of its side: 2.5 at 20, as legible as the row's 3 at 28. */
const THICKNESS_SHARE = 1 / 8

type Shared = WithTestID & {
  /** The size of the tonal button this stands in for, whose frame it draws. */
  size: ButtonSize
  /** Already worded: what the ring is announced as. */
  label: string
  /** See `ProgressRing`'s `still`. */
  still?: boolean | undefined
}

type Reading = {
  /** How far along, 0 to 1. */
  progress: number
  /** Already worded: the reading as a screen reader says it, such as "12 MB of 30 MB". */
  valueText: string
}

/** Nothing yet says how far along: the ring turns, and only the name is announced. */
type Pending = {
  indeterminate: true
}

export type ButtonProgressProps = Shared & (Reading | Pending)

/**
 * The progress bar's role and reading, in each platform's vocabulary. Native takes the reading as
 * one value; the web as ARIA, where a bar with no `aria-valuenow` is indeterminate.
 */
function progressBar(label: string, now: number | undefined, text: string | undefined) {
  if (!isWeb)
    return {
      accessible: true,
      role: 'progressbar',
      'aria-label': label,
      accessibilityValue: now === undefined ? {} : { min: 0, max: 100, now, text },
    } as const
  return {
    role: 'progressbar',
    'aria-label': label,
    'aria-valuemin': 0,
    'aria-valuemax': 100,
    ...(now === undefined ? {} : { 'aria-valuenow': now, 'aria-valuetext': text }),
  } as const
}

/**
 * A transfer's progress, drawn in the frame of the tonal icon button that stands where it does, so
 * nothing on the line moves when the button gives way to it and back.
 *
 * **Not a control.** No press, no hover or press state, no focus stop: there is nothing to do to a
 * transfer yet, because the bridge has no cancel. A screen reader finds it as a progress bar.
 * TODO: make this the cancel once libsession and the bridge can stop a transfer.
 *
 * The frame keeps its own fill on an accent bubble, as the button does, so the ring is the accent
 * text on the nested surface wherever it is drawn.
 */
export function ButtonProgress(props: ButtonProgressProps) {
  const { size, label, still, testID } = props
  const side = buttonHeight(size)
  const ringSide = Math.round(side * RING_SHARE)
  const ring = {
    size: ringSide,
    thickness: ringSide * THICKNESS_SHARE,
    color: '$accentText',
    trackColor: '$progressTrack',
    still,
  }
  const reading = 'progress' in props ? props : null
  const now =
    reading === null ? undefined : Math.round(Math.min(1, Math.max(0, reading.progress)) * 100)

  return (
    <YStack
      // The tonal button's frame: its size, its corner, and its nested fill edged in the same.
      width={side}
      height={side}
      borderRadius="$sm"
      borderWidth={1}
      backgroundColor="$backgroundNested"
      borderColor="$backgroundNested"
      alignItems="center"
      justifyContent="center"
      {...progressBar(label, now, reading?.valueText)}
      testID={testID}
    >
      {reading === null ? (
        <ProgressRing {...ring} indeterminate />
      ) : (
        <ProgressRing {...ring} progress={reading.progress} />
      )}
    </YStack>
  )
}
