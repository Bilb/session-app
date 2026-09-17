import type { DirectionRootProps } from './DirectionRoot.types'

export type { DirectionRootProps }

/**
 * Lays its children out in the given direction.
 *
 * Nothing to do on the web: `applyDirection` puts `dir` on the document element, which mirrors the
 * whole page including anything portalled out of this tree. A wrapper here would mirror less, not
 * more. It exists so the mobile root, which has no document to write on, can say the same thing.
 */
export function DirectionRoot({ children }: DirectionRootProps) {
  return <>{children}</>
}
