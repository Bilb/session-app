import { friends } from '@session/client/fake'
import { SessionClientError } from '@session/client'
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

describe('a start that fails', () => {
  it('ends in an error rather than in a wait that never finishes', async () => {
    // The launch screen renders while `hydrated` is false, and a rejection used to leave it false
    // for ever with nobody holding the promise -- indistinguishable from a database still
    // migrating, which is the shape the bug took on a device. A failure has to be an outcome.
    const { clients } = friends(['Alice', 'Bob'])
    const alice = clients['Alice']
    if (!alice) throw new Error('fixture did not produce a client')
    const store = createSessionStore(alice)

    // Shadowed on the instance rather than spread into a copy: the fake's methods live on its
    // prototype, so a spread produces an object with none of them.
    alice.getAccountInfo = () =>
      Promise.reject(new SessionClientError('markRead: Invalid conversation id'))

    // Resolves. `start` is the one action that turns a failure into state instead of throwing,
    // because its caller is an app's root and has nowhere to put a rejection.
    await expect(store.actions.start()).resolves.toBeUndefined()

    expect(store.getState().startupError).toBe('markRead: Invalid conversation id')
    expect(store.getState().hydrated).toBe(false)
  })

  it('clears the error when a start is tried again', async () => {
    const { clients } = friends(['Alice', 'Bob'])
    const alice = clients['Alice']
    if (!alice) throw new Error('fixture did not produce a client')
    const store = createSessionStore(alice)
    const real = alice.getAccountInfo.bind(alice)

    alice.getAccountInfo = () => Promise.reject(new SessionClientError('nope'))
    await store.actions.start()
    expect(store.getState().startupError).toBe('nope')

    alice.getAccountInfo = real
    await store.actions.start()
    expect(store.getState().startupError).toBeNull()
    expect(store.getState().hydrated).toBe(true)
  })
})
