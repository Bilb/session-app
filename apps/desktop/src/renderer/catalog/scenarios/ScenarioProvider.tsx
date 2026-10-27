import { DetachedMessages } from '@session/screens'
import { SessionStoreProvider } from '@session/state'
import { ModalStackProvider, ToastProvider } from '@session/ui'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

import { store } from '../../store'
import { prepare, type Scenario } from './prepare'

let prepared: Promise<Scenario> | null = null

const ScenarioContext = createContext<Scenario | null>(null)

/** Null until the showcase is prepared, which the provider waits for before drawing anything. */
export function useScenario(): Scenario | null {
  return useContext(ScenarioContext)
}

/** The store, the showcase loaded into it, and what a message row asks of its screen. */
export function ScenarioProvider({ children }: { children: ReactNode }) {
  const [scenario, setScenario] = useState<Scenario | null>(null)
  useEffect(() => {
    prepared ??= prepare(store)
    prepared.then(setScenario, (error: unknown) => {
      console.error('[catalog] preparing the showcase failed:', error)
    })
  }, [])
  if (scenario === null) return null
  return (
    <SessionStoreProvider store={store}>
      <DetachedMessages conversationId={scenario.conversationId}>
        <ScenarioContext.Provider value={scenario}>
          <ModalStackProvider>
            <ToastProvider>{children}</ToastProvider>
          </ModalStackProvider>
        </ScenarioContext.Provider>
      </DetachedMessages>
    </SessionStoreProvider>
  )
}
