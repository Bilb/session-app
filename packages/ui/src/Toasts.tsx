import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { withoutToast, withToast, type QueuedToast } from './toastQueue'

/** How long a toast stays before it dismisses itself. */
const DURATION_MS = 3000

export interface Toasts {
  /**
   * Shows a line of text for a moment.
   *
   * `id` names what it is about, so raising the same toast again -- copying twice -- shows it
   * afresh rather than stacking a second copy under the first.
   */
  show: (text: string, options?: { id?: string }) => void
}

interface ToastQueue {
  toasts: readonly QueuedToast[]
  dismiss: (serial: number) => void
}

const ToastsContext = createContext<Toasts | null>(null)
const QueueContext = createContext<ToastQueue>({ toasts: [], dismiss: () => undefined })

/**
 * Holds what is being said, for `ToastHost` to draw.
 *
 * One for the whole app, at the root beside the modal stack, for the same reason the stack is
 * there: a toast raised from inside a settings screen has to outlive that screen, and it belongs
 * over everything, the settings panel included.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<readonly QueuedToast[]>([])
  const nextSerial = useRef(0)
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>())

  useEffect(() => {
    const pending = timers.current
    return () => {
      for (const timer of pending) clearTimeout(timer)
    }
  }, [])

  const value = useMemo(() => {
    const dismiss = (serial: number) => {
      setToasts((current) => withoutToast(current, serial))
    }
    const toastsApi: Toasts = {
      show: (text, options) => {
        const serial = nextSerial.current++
        const id = options?.id ?? `toast-${String(serial)}`
        setToasts((current) => withToast(current, { id, text, serial }))
        const timer = setTimeout(() => {
          timers.current.delete(timer)
          dismiss(serial)
        }, DURATION_MS)
        timers.current.add(timer)
      },
    }
    return { toastsApi, dismiss }
  }, [])

  const queue = useMemo(() => ({ toasts, dismiss: value.dismiss }), [toasts, value.dismiss])

  return (
    <ToastsContext.Provider value={value.toastsApi}>
      <QueueContext.Provider value={queue}>{children}</QueueContext.Provider>
    </ToastsContext.Provider>
  )
}

/** Raising a toast. Throws outside a `ToastProvider`, which is a wiring fault. */
export function useToast(): Toasts {
  const toasts = useContext(ToastsContext)
  if (toasts === null) throw new Error('No ToastProvider. Wrap the app in <ToastProvider>.')
  return toasts
}

/** What the host draws, newest first. */
export function useToastQueue(): ToastQueue {
  return useContext(QueueContext)
}
