import { friends } from '@session/client/fake'
import { describe, expect, it } from 'vitest'

import { createSessionStore } from '#src/store'

describe('hydrating a device that has no account', () => {
  it('clears what the previous account left in memory', async () => {
    // The case onboarding creates: somebody backs out of restoring one account to restore another,
    // the database is deleted and the client is rebuilt. libsession then has nothing -- but the
    // store is the same object it always was, and `setState` merges, so an account-shaped update
    // leaves the previous account's conversations sitting in memory behind the new one.
    const { world, clients } = friends(['Alice', 'Bob'])
    const alice = clients['Alice']
    if (!alice) throw new Error('fixture did not produce a client')
    const store = createSessionStore(alice)

    await store.actions.hydrate()
    expect(store.getState().conversations.length).toBeGreaterThan(0)

    // Now the account goes, the way a discard leaves it.
    world.account('Alice').haveAccount = false
    await store.actions.hydrate()

    const after = store.getState()
    expect(after.account?.haveAccount).toBe(false)
    expect(after.conversations).toEqual([])
    expect(after.requests).toEqual([])
    expect(after.histories).toEqual({})
    // Still hydrated: the question was asked and answered, and the answer was "nothing".
    expect(after.hydrated).toBe(true)
  })
})
