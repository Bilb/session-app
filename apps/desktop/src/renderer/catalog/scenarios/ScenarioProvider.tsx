import { DetachedMessages } from '@session/screens'
import { SessionStoreProvider } from '@session/state'
import { ModalStackProvider, ToastProvider } from '@session/ui'
import { CatalogPictures, CatalogPlaceholders } from '@session/ui/catalog'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

import { store } from '../../store'
import { prepare, type Scenario } from './prepare'

let prepared: Promise<Scenario> | null = null

const ScenarioContext = createContext<Scenario | null>(null)

/** Null until the showcase is prepared, which the provider waits for before drawing anything. */
export function useScenario(): Scenario | null {
  return useContext(ScenarioContext)
}

function usePrepared(): Scenario | null {
  const [scenario, setScenario] = useState<Scenario | null>(null)
  useEffect(() => {
    prepared ??= prepare(store)
    prepared.then(setScenario, (error: unknown) => {
      console.error('[catalog] preparing the showcase failed:', error)
    })
  }, [])
  return scenario
}

/** The store, the showcase loaded into it, and what a message row asks of its screen. */
export function ScenarioProvider({ children }: { children: ReactNode }) {
  const scenario = usePrepared()
  if (scenario === null) return null
  return (
    <SessionStoreProvider store={store}>
      <DetachedMessages conversationId={scenario.conversationId}>
        <ScenarioContext.Provider value={scenario}>
          <CatalogPictures.Provider value={scenario.pictures}>
            <CatalogPlaceholders.Provider value={scenario.placeholders}>
              <ModalStackProvider>
                <ToastProvider>{children}</ToastProvider>
              </ModalStackProvider>
            </CatalogPlaceholders.Provider>
          </CatalogPictures.Provider>
        </ScenarioContext.Provider>
      </DetachedMessages>
    </SessionStoreProvider>
  )
}

/**
 * The showcase's photographs for a component story that declares `pictures`, which has no store
 * of its own. Drawn once they are known, so a page never captures before its pictures are on it.
 */
export function PicturesProvider({ children }: { children: ReactNode }) {
  const scenario = usePrepared()
  if (scenario === null) return null
  return (
    <CatalogPictures.Provider value={scenario.pictures}>
      <CatalogPlaceholders.Provider value={scenario.placeholders}>
        {children}
      </CatalogPlaceholders.Provider>
    </CatalogPictures.Provider>
  )
}
