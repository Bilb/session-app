import { createContext, useContext } from 'react'

import { SPACE_SCALE } from './scales'

/**
 * How far a top bar touching the window's top-leading corner has to keep its content in, to clear
 * the window's close, minimise and zoom controls -- beyond the safe area `Screen` already keeps.
 *
 * iPadOS 26 draws those controls inside a resizable window and leaves them out of the safe area.
 * Supplied by the app, which can ask the platform; zero everywhere else, the desktop included,
 * where the controls sit in a title bar of their own.
 */
const WindowControlsInsetContext = createContext(0)

export const WindowControlsInsetProvider = WindowControlsInsetContext.Provider

export function useWindowControlsInset(): number {
  return useContext(WindowControlsInsetContext)
}

/**
 * The leading padding a top bar with the usual `$md` side padding needs to clear the window's
 * controls, or undefined when its own padding already does.
 *
 * The platform reports a few points even where no controls are drawn -- the margin the window's
 * rounded corner asks for -- which is less than the bar keeps anyway. Taking it as the padding
 * would pull the bar's content towards the edge in every full-screen window.
 */
export function useTopBarControlsPadding(): number | undefined {
  const inset = useWindowControlsInset()
  return inset > SPACE_SCALE.md ? inset : undefined
}
