import type { NetworkStatus, SessionEvent } from '@session/bridge-types'
import { describe, expect, it } from 'vitest'

import { friends, newcomer } from '#src/fake/index'

const MAINNET = { netid: 'mainnet' }

function statuses(events: SessionEvent[]): NetworkStatus[] {
  return events.flatMap((e) => (e.type === 'network-status-changed' ? [e.status] : []))
}

describe("the fake's network status", () => {
  it('starts unknown, then connects and has a path, once a network is attached to an account', async () => {
    const { world, clients } = friends(['Alice', 'Bob'], { history: 0 })
    const alice = clients['Alice']
    if (!alice) throw new Error('no Alice')
    const events: SessionEvent[] = []
    alice.onEvent((e) => events.push(e))

    await alice.attachNetwork(MAINNET)
    expect(statuses(events)).toEqual(['unknown'])
    expect(await alice.getNetworkStatus()).toBe('unknown')

    world.settle()
    expect(statuses(events)).toEqual(['unknown', 'connecting', 'connected'])
    expect(await alice.getNetworkStatus()).toBe('connected')
    expect((await alice.getAccountInfo()).networkAttached).toBe(true)
  })

  it('waits for an account, and goes online on the one onboarding makes', async () => {
    const { world, clients } = newcomer()
    const alice = clients['Alice']
    if (!alice) throw new Error('no Alice')
    const events: SessionEvent[] = []
    alice.onEvent((e) => events.push(e))

    await alice.attachNetwork(MAINNET)
    expect(statuses(events)).toEqual([])
    expect((await alice.getAccountInfo()).networkAttached).toBe(false)

    await alice.createAccount()
    world.settle()
    expect(statuses(events)).toEqual(['unknown', 'connecting', 'connected'])
  })

  it('reports disconnected as a discard takes the network, and reconnects on the next account', async () => {
    const { world, clients } = friends(['Alice', 'Bob'], { history: 0 })
    const alice = clients['Alice']
    if (!alice) throw new Error('no Alice')
    await alice.attachNetwork(MAINNET)
    world.settle()
    const events: SessionEvent[] = []
    alice.onEvent((e) => events.push(e))

    await alice.discardAccount()
    expect(statuses(events)).toEqual(['disconnected'])
    expect(await alice.getNetworkStatus()).toBe('disconnected')

    await alice.createAccount()
    world.settle()
    expect(statuses(events)).toEqual(['disconnected', 'unknown', 'connecting', 'connected'])
  })
})
