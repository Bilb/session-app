import { createContext, createElement, useContext, type ReactNode } from 'react'

/**
 * Whether the app may use the camera, as the OS currently sees it.
 *
 * `blocked` is the one worth naming separately: asking again does nothing, so the only way
 * forward is the app's own settings page, and a screen that cannot tell it apart from `denied`
 * offers a button that silently does nothing.
 */
export type CameraAccess = 'unknown' | 'granted' | 'denied' | 'blocked'

/**
 * Seeing through the camera, without saying what draws it.
 *
 * A render-scoped port rather than a module one, like NavPort and for the same reason: the preview
 * is a *component*, and a component cannot be handed over by `setPorts` -- the platform that owns
 * it has to put it in the tree. expo-camera may only be imported from `apps/mobile`, and the
 * desktop app has no camera at all, so this is the seam between them.
 */
export interface CameraPort {
  /** What the OS says right now. `unknown` until it has been asked once. */
  access: CameraAccess
  /**
   * How the control that asks for the camera should describe itself.
   *
   * **Not a style choice.** Apple rejected a release of the legacy client whose button said "Grant
   * Camera Access", on the grounds that pressing it does not grant anything -- it opens the OS
   * prompt, which is free to refuse. The clients have said different things on the two platforms
   * ever since, so which one this is is a fact about the store the build ships through and belongs
   * here rather than in the screen.
   */
  ask: 'grant' | 'continue'
  /**
   * Ask the OS, showing its prompt if this is the first time.
   *
   * Resolves with what the answer became, which is what a screen needs to decide what to draw
   * next: a rejection is a different screen from a grant, and `blocked` is a third.
   */
  request(): Promise<CameraAccess>
  /**
   * The live camera, reading QR codes out of what it sees.
   *
   * Only meaningful once access is `granted`; before that there is nothing to draw. Scanning is
   * part of the preview rather than a separate call because the decoder runs on the frames, and
   * pulling frames across this seam to decode them elsewhere would be a video pipeline for no
   * reason.
   */
  Preview(props: { onScan: (value: string) => void; testID?: string }): ReactNode
}

const CameraContext = createContext<CameraPort | null>(null)

export function CameraProvider(props: { camera: CameraPort; children: ReactNode }): ReactNode {
  return createElement(CameraContext.Provider, { value: props.camera }, props.children)
}

/**
 * The camera, or null where the platform has none.
 *
 * Null rather than a throw, unlike `useNav`: a screen that offers scanning is expected to run on
 * the desktop app too, where there is nothing to provide and the honest answer is that the feature
 * is absent.
 */
export function useCamera(): CameraPort | null {
  return useContext(CameraContext)
}
