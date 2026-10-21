/** Where the app's own update has got to. Nothing to show is no indicator at all. */
export type UpdateStatus =
  | { kind: 'available' }
  | { kind: 'downloading'; progress: number }
  | { kind: 'ready' }
  | { kind: 'error' }

export interface UpdateIndicatorProps {
  status: UpdateStatus
  /** While downloading, the percentage inside the ring in place of the glyph. */
  showPercent?: boolean | undefined
  /** Cut rather than cross-fade between states. See the `disableAnimations` flag. */
  instant?: boolean | undefined
  testID?: string | undefined
}
