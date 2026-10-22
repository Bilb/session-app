/** Where the app's own update has got to. Nothing to show is no indicator at all. */
export type UpdateStatus =
  | { kind: 'available' }
  | { kind: 'downloading'; progress: number }
  | { kind: 'ready' }
  | { kind: 'error' }

export interface UpdateIndicatorProps {
  status: UpdateStatus
  /** Cut rather than cross-fade between states. See the `disableAnimations` flag. */
  instant?: boolean | undefined
  testID?: string | undefined
}
