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
  /**
   * The row of actions along the bottom, outside the scrolling body.
   *
   * The client's `buttonChildren`, and the same division of labour: the frame belongs to the
   * modal and what goes in it belongs to the screen, so a screen with nothing to confirm simply
   * does not supply one.
   */
  footer?: () => ReactNode
}

export interface ModalPresentation {
  /**
   * A panel of screens, or a single alert. Defaults to `panel`.
   *
   * An alert is `Modal`'s dialog shown over the stack -- a confirm asked from inside settings --
   * so there is one alert in the app however it was opened. It has one screen: its title, its body
   * and its footer as the actions.
   */
  kind?: 'panel' | 'alert'
  /** Which of the client's three widths a panel draws at. Defaults to `normal`. */
  width?: PanelWidth
  /** The alert's own ids, since an alert is not the settings panel and a test addresses it. */
  testID?: string
  closeTestID?: string
  /**
   * Whether the scrim, Escape and the hardware back button may close it. Defaults to true.
   *
   * Off for something that has to be answered. It does not stop the modal's *own* screens being
   * walked back -- a wizard that must be finished can still have a back control.
   */
  dismissible?: boolean
  /**
   * Whether an alert draws the cross in its corner. Defaults to `dismissible`.
   *
   * Off for one that asks a question and puts its own Cancel in the actions: a cross beside two
   * labelled answers is a third, unlabelled one. Such an alert can still be left from the scrim --
   * the desktop client's Clear All Data has no cross and closes on a click outside.
   */
  showClose?: boolean
  /** The screen it opens on. Further screens arrive through `push`. */
  initial: ModalScreen
}

/**
 * A screen as the stack holds it.
 *
 * With an identity of its own, because every screen of a panel stays mounted: a screen popped and
 * another pushed in its place has to be a new component, not the old one's -- scroll position and
 * all -- showing different contents.
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
   * Stops the named modal being dismissed from the scrim, Escape or the back button, for one whose
   * action has started: leaving a confirm while what it confirmed is still running says it was
   * cancelled when it was not. Unknown ids are ignored.
   */
  lock: (id: string) => void
}

const ModalsContext = createContext<Modals | null>(null)

/** The stack itself, for the host that draws it. Separate so a caller re-renders only on its own. */
const EntriesContext = createContext<readonly OpenModal[]>([])

/**
 * Holds what is open over the page.
 *
 * **One provider for the whole app, mounted at the root.** A modal opened from a settings row three
 * components deep must not be drawn inside that row -- it belongs over everything, it has to
 * outlive the row being unmounted, and a modal that opens another has to be able to sit under it.
 * So callers name what they want opened and nothing else; where it is drawn is this module's.
 * Inside the store and the navigator, since what it draws are screens that read both.
 *
 * The rules for what closes what are in `modalStack.ts`, deliberately apart from react: they are
 * the part worth holding still.
 */
export function ModalStackProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<readonly OpenModal[]>([])

  /**
   * Ids are a counter rather than the array's length or a random value: length repeats as soon as
   * something is closed and reopened, and a close handler holding the old id would then shut the
   * new modal. Monotonic means an id names one presentation for ever.
   */
  const nextId = useRef(0)

  const modals = useMemo<Modals>(() => {
    // Acts on the frontmost modal, because that is the only one anybody can be interacting with.
    // Returning the stack unchanged when there is nothing to do keeps every caller free of the
    // check -- `pop` on a first screen is what a back control does at the bottom of one.
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

      /**
       * Pushes a screen, keeping the one below it.
       *
       * **A history stack, not a parent map**: back returns where you came from, so a screen
       * reachable from two places needs no table saying which one it returns to, and cannot return
       * to the wrong one.
       */
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

/**
 * What the frontmost modal's chrome shows, and what its controls do.
 *
 * Asked for rather than passed down, so a screen deep inside a modal can push another screen
 * without every component between it and the host forwarding a callback.
 */
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
