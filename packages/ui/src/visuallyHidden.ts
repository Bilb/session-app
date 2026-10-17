/**
 * Undrawn but in the accessibility tree, which `display: none` is not. For a 1 px box with its
 * overflow hidden, positioned out of its parent's layout.
 */
export const VISUALLY_HIDDEN = { clipPath: 'inset(50%)', whiteSpace: 'nowrap' } as const
