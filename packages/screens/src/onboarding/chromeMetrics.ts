import { useMedia } from '@session/ui'
import { useEffect, useState } from 'react'

/**
 * The figures the two onboarding layouts are drawn to, and the two hooks that read them.
 *
 * Here rather than in either layout because several of them have a **different right answer per
 * layout** and that is exactly where this port keeps going wrong: the step inset was written out
 * twice and only the phone's half was copied, which left the recovery-password step 70 narrower
 * and 25 lower than every other step on Desktop. A figure that differs by layout is a decision,
 * so it is made once, here, and asked for -- never restated where it is used.
 */

/**
 * The pixel size both header rings are drawn at.
 *
 * One number for both, because `circleHelp` brings its own ring and `IconRing` draws the other:
 * they share a viewBox, so equal boxes make equal circles and unequal boxes make the difference
 * that kept being reported.
 */
export const RING_SIZE = 22

/**
 * How long the content takes to fade in when a step changes.
 *
 * The desktop client's `--duration-fadein`. Long enough to read as a transition rather than a
 * flicker, which is what makes moving between steps feel like one screen changing its mind rather
 * than four screens replacing each other.
 */
export const FADE_MS = 400

/**
 * Fades from nothing to full whenever `key` changes.
 *
 * Two frames, not an easing curve: the opacity is handed to a tamagui stack, which animates it for
 * us. Written by hand rather than with an animation library because this is the only thing in the
 * app that needs it and a driver is a dependency.
 */
export function useFadeIn(key: string, instant: boolean): number {
  const [shown, setShown] = useState(instant)
  useEffect(() => {
    // The flag exists so an automated run is not racing a transition it cannot see. Nothing to
    // schedule and nothing to undo: the content is simply already there.
    if (instant) return
    setShown(false)
    // Next frame rather than immediately: setting both values in one tick gives no transition to
    // interpolate and the content simply appears.
    const raf = setTimeout(() => {
      setShown(true)
    }, 16)
    return () => {
      clearTimeout(raf)
    }
  }, [key, instant])
  return shown ? 1 : 0
}

/**
 * The height every step's content is given, however short it really is.
 *
 * The desktop client's own number, taken from the tallest step, and its comment says what it is
 * for: *"Min height should match the onboarding step with the largest height -- this prevents the
 * loading spinner from jumping around while still keeping things centered."*
 *
 * **It sits on the column rather than on the step, which is where the client puts it.** In the
 * client the reserve is on the back-button wrapper, so only a step with a back button gets it and
 * the landing screen stands at its own height -- the block is then centred at two different heights
 * and the lockup, the heading and the buttons all move as you go from the landing screen to the
 * next one. Here every screen reserves the same box, so the block is one size and the content
 * starts at the same place throughout: nothing jumps, at the cost of the short screens sitting
 * above the middle rather than on it. A product call, and the reason for the difference.
 *
 * That upward bias is the reserve's own doing rather than a separate nudge: short content
 * top-aligns in the box and the empty part of it hangs below. The landing screen, the shortest,
 * reads about 70px high; the steps read about 20px high.
 */
export const CONTENT_MIN_HEIGHT = 276

/**
 * The phone design's two horizontal insets.
 *
 * **Both clients use two, not one**, and they agree with each other: the reading column is inset
 * 35 on iOS (`Values.veryLargeSpacing`) and 36 on Android (`mediumSpacing`), and the primary
 * button is inset 64 on both (`massiveSpacing` / `xlargeSpacing`). The relationship is the part
 * worth porting rather than either number: **the button is deliberately narrower than the text it
 * sits under.** Ours was a single 15 everywhere, under half the body inset and under a quarter of
 * the button's.
 *
 * 35 is the space scale's `$4`; 64 is not on the scale and is written as itself, since inventing a
 * rung for one value would make the scale less useful rather than more.
 */
const CONTENT_INSET = 35

/** The legacy client's navigation-bar mark: `SessionGreen32`, pinned to a 32pt square. */
export const BAR_LOGO_SIZE = 32
const ACTION_INSET = 64

/** What an action needs on top of the content inset it already sits inside. */
export const EXTRA_ACTION_INSET = ACTION_INSET - CONTENT_INSET

/** The room the phone layout leaves around a step. The wide one leaves none -- see below. */
export const STEP_PADDING = {
  paddingHorizontal: CONTENT_INSET,
  paddingTop: '$3',
  paddingBottom: '$2',
} as const

/**
 * The same padding, for a pane that has to apply it itself.
 *
 * `LoadAccountScreen` turns `padContent` off because its two panes disagree about the inset -- the
 * field belongs in the reading column and the camera fills the width -- and pads the one that
 * wants it. That left the figure written down in two places and only the narrow half of it was
 * copied: on the wide branch the column is already `COLUMN_WIDTH` and the chrome adds no
 * horizontal inset at all, so the recovery-password step alone drew 70 narrower and 25 lower than
 * every other step on Desktop.
 */
export function useStepPadding(): Partial<typeof STEP_PADDING> {
  return useMedia().gtSm ? {} : STEP_PADDING
}
