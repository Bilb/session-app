import type { ReactNode } from 'react'

export interface DropZoneProps {
  /** Whether files are being held over the zone, for the screen to draw its overlay. */
  onActive: (active: boolean) => void
  /**
   * What was dropped, as the platform hands it over.
   *
   * Opaque here, because turning one into a path is the files port's job: on Electron it takes
   * the preload, and nothing in a shared package may reach that. `skipped` counts the folders left
   * out, which have a path but are not a file anything can send.
   */
  onDrop: (items: readonly unknown[], skipped: number) => void
  children: ReactNode
  /** Drawn over everything it wraps, filling it, while files are held over it. */
  overlay?: ReactNode | undefined
}
