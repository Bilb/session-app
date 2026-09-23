import { setLayoutRtl } from './layoutDirection'

/**
 * Mirrors the layout, or puts it back.
 *
 * The native half, and it does not go through `I18nManager`. That decides the direction once when
 * the bridge starts and holds it for the life of the process, so `forceRTL` cannot mirror the app
 * somebody is looking at -- only the next launch of it, which is no use when the language is
 * chosen in the app. The mirror is Yoga's own `direction` instead, set on the root by
 * `DirectionRoot`: every `start`/`end` edge below resolves against it, and it takes effect on
 * the next layout pass rather than the next launch.
 *
 * So all this does is record the answer, for the few things that have to agree with the layout
 * without being laid out by it.
 */
export function applyDirection(rtl: boolean): void {
  setLayoutRtl(rtl)
}
