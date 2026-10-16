/**
 * The panes `AdaptiveShell` draws, apart from the hooks that read them so that a test can import
 * them without the UI package.
 */

/** Where a screen is being drawn, as `AdaptiveShell` laid it out. */
export interface Pane {
  /** Drawn beside the conversation list, which is then the way back. */
  besideList: boolean
  /** Touches the window's top-leading corner, where a resizable iPad window draws its controls. */
  atLeadingEdge: boolean
}

export const SOLE_PANE: Pane = { besideList: false, atLeadingEdge: true }
export const LIST_PANE: Pane = { besideList: false, atLeadingEdge: true }
export const DETAIL_PANE: Pane = { besideList: true, atLeadingEdge: false }
