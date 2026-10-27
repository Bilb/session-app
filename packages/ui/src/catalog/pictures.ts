import { createContext, useContext } from 'react'

/**
 * Photographs a story can draw, supplied by the app around the catalog: its content policy admits
 * no `data:` URL, and only the app knows a URL it serves.
 */
export const CatalogPictures = createContext<readonly string[]>([])

/** The `at`th picture, wrapping round, or none where nothing supplies them. */
export function useCatalogPicture(at: number | undefined): string | undefined {
  const pictures = useContext(CatalogPictures)
  if (at === undefined || pictures.length === 0) return undefined
  return pictures[at % pictures.length]
}
