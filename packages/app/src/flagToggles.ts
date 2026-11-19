import type { SessionStore } from '@session/state'

import { FLAGS, setFlagToggles, type FlagName } from './flags'

function isFlag(name: string): name is FlagName {
  return Object.hasOwn(FLAGS, name)
}

/** The stored toggles, less any for a flag this build no longer has. */
function known(stored: Readonly<Record<string, boolean>>): Partial<Record<FlagName, boolean>> {
  return Object.fromEntries(Object.entries(stored).filter(([name]) => isFlag(name)))
}

/**
 * Keeps `flag` answering with the flags switched in Developer Settings, as the store holds them.
 *
 * A store subscriber, which zustand calls inside the update itself: the toggles arrive with the
 * account in the same update as `hydrated`, so they are in place before the first screen that
 * reads a flag is drawn. Called once by each app, beside the store it creates; answers the
 * unsubscribe.
 */
export function followFlagToggles(store: SessionStore): () => void {
  setFlagToggles(known(store.getState().flagToggles))
  return store.subscribe((state, previous) => {
    if (state.flagToggles !== previous.flagToggles) setFlagToggles(known(state.flagToggles))
  })
}
