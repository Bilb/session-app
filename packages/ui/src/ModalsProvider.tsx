import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { backAction, dismissFrom, type StackedModal } from './modalStack'
import type { PanelWidth } from './modalPanelMetrics'

/** One page inside a modal. A modal always has at least one. */
export interface ModalScreen {
  /** Drawn in the modal's own header, so a screen does not draw a title of its own. */
  title: string
  render: () => ReactNode
  /** Actions along the bottom, outside the scrolling body. */
  footer?: () => ReactNode
}

export interface ModalPresentation {
  /**
   * A panel of screens, or a single alert. Defaults to `panel`. An alert is drawn as `Modal`'s
   * `AlertBox`, with its one screen's footer as the actions.
   */
  kind?: 'panel' | 'alert'
  /** Which of the three panel widths it draws at. Defaults to `normal`. */
  width?: PanelWidth
  /** An alert's own test ids. */
  testID?: string
  closeTestID?: string
  /**
   * Whether the scrim, Escape and the hardware back button may close it. Defaults to true. Its own
   * screens can still be walked back either way.
   */
  dismissible?: boolean
  /**
   * Whether an alert draws the cross in its corner. Defaults to `dismissible`. Turn it off when the
   * actions include a Cancel; the scrim still closes it, as Clear All Data's does.
   */
  showClose?: boolean
  /** The screen it opens on. Further screens arrive through `push`. */
  initial: ModalScreen
}

/**
 * A screen with a key of its own: every screen stays mounted, so one pushed in place of a popped
 * one must remount rather than inherit the old one's state.
 */
interface HeldScreen extends ModalScreen {
  key: string
}

/** A presented modal, with the screens it has been walked through. */
export interface OpenModal extends StackedModal {
  kind: 'panel' | 'alert'
  width: PanelWidth
  showClose: boolean
  testID?: string
  closeTestID?: string
  stack: HeldScreen[]
}

export interface Modals {
  /** Opens a modal over anything already open, and returns the id that closes it. */
  present: (presentation: ModalPresentation) => string
  /** Closes the named modal **and anything opened from it**. Unknown ids are ignored. */
  dismiss: (id: string) => void
  /** Pushes a screen onto the frontmost modal. */
  push: (screen: ModalScreen) => void
  /** Pops the frontmost modal's own screen stack, stopping at its first screen. */
  pop: () => void
  /** One level back: a screen if there is one to go back to, otherwise the modal. */
  back: () => void
  /** Closes everything, for a navigation that leaves the surface the modals belong to. */
  dismissAll: () => void
  /**
   * Makes the named modal non-dismissible, for a confirm whose action is running: leaving it then
   * implies a cancel that did not happen. Unknown ids are ignored.
   */
  lock: (id: string) => void
}

const ModalsContext = createContext<Modals | null>(null)

/** Separate from `ModalsContext` so `useModals` callers do not re-render on every stack change. */
const EntriesContext = createContext<readonly OpenModal[]>([])

/**
 * Holds what is open over the page. Mount once at the app root, inside the store and the
 * navigator, since the screens it draws read both.
 */
export function ModalStackProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<readonly OpenModal[]>([])

  // Monotonic, so a stale close handler can never match a later modal.
  const nextId = useRef(0)

  const modals = useMemo<Modals>(() => {
    // Applies `change` to the frontmost modal; `null` leaves the stack unchanged.
    function mapTop(change: (entry: OpenModal) => OpenModal | null): void {
      setEntries((current) => {
        const top = current.at(-1)
        if (top === undefined) return current
        const replacement = change(top)
        return replacement === null ? current : [...current.slice(0, -1), replacement]
      })
    }

    return {
      present: ({
        initial,
        dismissible = true,
        width = 'normal',
        kind = 'panel',
        showClose = dismissible,
        testID,
        closeTestID,
      }) => {
        const id = `modal-${String(nextId.current++)}`
        setEntries((current) => [
          ...current,
          {
            id,
            dismissible,
            width,
            kind,
            showClose,
            ...(testID === undefined ? {} : { testID }),
            ...(closeTestID === undefined ? {} : { closeTestID }),
            screens: 1,
            stack: [{ ...initial, key: `screen-${String(nextId.current++)}` }],
          },
        ])
        return id
      },

      dismiss: (id) => {
        setEntries((current) => dismissFrom(current, id))
      },

      push: (screen) => {
        const key = `screen-${String(nextId.current++)}`
        mapTop((top) => ({
          ...top,
          screens: top.screens + 1,
          stack: [...top.stack, { ...screen, key }],
        }))
      },

      pop: () => {
        mapTop((top) =>
          top.stack.length <= 1
            ? null
            : { ...top, screens: top.screens - 1, stack: top.stack.slice(0, -1) },
        )
      },

      back: () => {
        setEntries((current) => {
          const action = backAction(current)
          if (action.kind === 'none') return current
          if (action.kind === 'modal') return current.slice(0, -1)
          const top = current.at(-1)
          if (top === undefined || top.stack.length <= 1) return current
          return [
            ...current.slice(0, -1),
            { ...top, screens: top.screens - 1, stack: top.stack.slice(0, -1) },
          ]
        })
      },

      dismissAll: () => {
        setEntries([])
      },

      lock: (id) => {
        setEntries((current) =>
          current.map((entry) => (entry.id === id ? { ...entry, dismissible: false } : entry)),
        )
      },
    }
  }, [])

  return (
    <ModalsContext.Provider value={modals}>
      <EntriesContext.Provider value={entries}>{children}</EntriesContext.Provider>
    </ModalsContext.Provider>
  )
}

/** Opening and closing modals. Throws outside a `ModalStackProvider`, which is a wiring fault. */
export function useModals(): Modals {
  const modals = useContext(ModalsContext)
  if (modals === null)
    throw new Error('No ModalStackProvider. Wrap the app in <ModalStackProvider>.')
  return modals
}

/** What the host has to draw: every open modal, frontmost last. */
export function useModalEntries(): readonly OpenModal[] {
  return useContext(EntriesContext)
}

/** The frontmost modal's title and navigation, for a screen deep inside it. */
export function useModalNavigation(): {
  title: string
  canGoBack: boolean
  push: (screen: ModalScreen) => void
  back: () => void
} {
  const entries = useModalEntries()
  const modals = useModals()
  const top = entries.at(-1)
  const { push, back } = modals
  const stableBack = useCallback(() => {
    back()
  }, [back])
  return {
    title: top?.stack.at(-1)?.title ?? '',
    canGoBack: (top?.stack.length ?? 0) > 1,
    push,
    back: stableBack,
  }
}
