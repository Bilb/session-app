import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

import { OpenUrlModal } from './OpenUrlModal'

/**
 * Asks the one confirmation dialog to open, from wherever a link was pressed.
 *
 * A context rather than a prop threaded down, because the links are not in one place: two sit in
 * the header that wraps every step, two more in the landing screen's footer, and each screen is
 * rendered inside the chrome rather than beside it. Passing a callback would mean every screen
 * taking a prop it does not use in order to hand it to the frame around it.
 *
 * One dialog for all four, so two cannot be open at once -- which is the other reason it is not
 * per-link state.
 */
const ConfirmUrlContext = createContext<((url: string) => void) | null>(null)

export function ConfirmUrlProvider({ children }: { children: ReactNode }) {
  const [url, setUrl] = useState<string | null>(null)
  // Stable, so a consumer does not re-render every time the dialog opens or closes.
  const confirm = useMemo(
    () => (next: string) => {
      setUrl(next)
    },
    [],
  )

  return (
    <ConfirmUrlContext.Provider value={confirm}>
      {children}
      <OpenUrlModal
        url={url}
        onClose={() => {
          setUrl(null)
        }}
      />
    </ConfirmUrlContext.Provider>
  )
}

export function useConfirmUrl(): (url: string) => void {
  const confirm = useContext(ConfirmUrlContext)
  if (confirm === null) {
    throw new Error('No ConfirmUrlProvider. Onboarding links need one above them.')
  }
  return confirm
}
