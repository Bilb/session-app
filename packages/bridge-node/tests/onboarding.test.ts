/**
 * The sequence onboarding performs, against real libsession.
 *
 * Every screen in the flow had been driven against the fake, which answers these three calls
 * happily whatever libsession would do. This is the same three calls through the addon: the
 * account has to be absent before the flow starts, present after the last step, and carry the
 * name that was typed. Offline throughout - nothing here attaches a network, so it runs
 * wherever the addon builds.
 */

import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createSessionClient, type SessionClient } from '@session/client'
import { describe, expect, it } from 'vitest'

import { createNodeBridgeTransport } from '#src/index'

const addon = join(import.meta.dirname, '../build/Release/session_bridge_node.node')

const describeAddon = existsSync(addon) ? describe : describe.skip

/** A client on its own database, with no account: where onboarding starts. */
async function newcomer(
  seed: number,
): Promise<{ client: SessionClient; dispose: () => Promise<void> }> {
  const dir = await mkdtemp(join(tmpdir(), 'session-onboarding-'))
  await mkdir(join(dir, 'cache'), { recursive: true })
  const client = createSessionClient(
    createNodeBridgeTransport({
      dbPath: join(dir, 'session.db'),
      cacheDir: join(dir, 'cache'),
      rawKey: new Uint8Array(32).fill(seed),
      // What makes onboarding reachable at all: without it libsession mints an account as the
      // database opens and the flow has nothing left to ask.
      deferAccount: true,
    }),
  )
  return {
    client,
    dispose: async () => {
      client.close()
      await rm(dir, { recursive: true, force: true })
    },
  }
}

describeAddon('onboarding, against libsession', () => {
  it('creates an account and names it, in the order the flow does', async () => {
    const { client, dispose } = await newcomer(11)

    try {
      const before = await client.getAccountInfo()
      expect(before.haveAccount).toBe(false)
      expect(before.sessionId).toBeUndefined()

      await client.createAccount()
      await client.setDisplayName('Weekend Test')

      const after = await client.getAccountInfo()
      expect(after.haveAccount).toBe(true)
      expect(after.sessionId).toMatch(/^05[0-9a-f]{64}$/)
      expect(after.displayName).toBe('Weekend Test')
    } finally {
      await dispose()
    }
  })

  it('brings the same account back from the same seed', async () => {
    // The property the recovery screen rests on. Asserted as agreement between two databases
    // rather than against a written-down ID, so it is libsession's derivation being checked and
    // not a constant somebody pasted.
    const hexSeed = 'a1'.repeat(32)
    const first = await newcomer(12)
    const second = await newcomer(13)

    try {
      await first.client.restoreAccount({ hexSeed })
      await second.client.restoreAccount({ hexSeed })

      const one = await first.client.getAccountInfo()
      const two = await second.client.getAccountInfo()
      expect(one.sessionId).toMatch(/^05[0-9a-f]{64}$/)
      expect(two.sessionId).toBe(one.sessionId)
    } finally {
      await first.dispose()
      await second.dispose()
    }
  })

  it('takes back the words it gave out', async () => {
    // The whole of restore, end to end: the phrase the account screen shows is the phrase the
    // recovery screen has to accept, and it has to bring back the same identity. Read out of
    // libsession rather than written here, because a pasted phrase tests the paste.
    const origin = await newcomer(15)
    const restored = await newcomer(16)

    try {
      await origin.client.createAccount()
      const words = await origin.client.getSeedMnemonic()
      const mine = await origin.client.getAccountInfo()

      await restored.client.restoreAccount({ words })
      const theirs = await restored.client.getAccountInfo()
      expect(theirs.sessionId).toBe(mine.sessionId)
    } finally {
      await origin.dispose()
      await restored.dispose()
    }
  })

  it('tells a misspelt phrase apart from a mistyped one', async () => {
    // Two refusals the recovery screen says different things about. libsession distinguishes
    // them - an unknown word by name, a checksum that does not add up - and the messages have to
    // stay distinguishable for that screen to keep being able to.
    const origin = await newcomer(17)
    const typist = await newcomer(18)
    const client = typist.client

    try {
      await origin.client.createAccount()
      const words = await origin.client.getSeedMnemonic()

      const misspelt = [...words]
      misspelt[0] = 'zzzzz'
      const misspeltError = await client
        .restoreAccount({ words: misspelt })
        .catch((e: unknown) => e)

      // The same words, two of them swapped: every word is real and the checksum is not.
      const swapped = [...words]
      const [a, b] = [swapped[0], swapped[1]]
      if (a === undefined || b === undefined) throw new Error('a phrase this short cannot happen')
      swapped[0] = b
      swapped[1] = a
      const swappedError = await client.restoreAccount({ words: swapped }).catch((e: unknown) => e)

      expect(String(misspeltError)).toContain('zzzzz')
      expect(String(swappedError)).toMatch(/checksum/i)

      // Two refusals in a row on the same client, and still nothing minted: what lets the screen
      // put somebody back on the field they typed into as many times as they need.
      expect((await client.getAccountInfo()).haveAccount).toBe(false)
    } finally {
      await origin.dispose()
      await typist.dispose()
    }
  })

  it('checks a phrase without making an account out of it', async () => {
    // What lets the recovery screen refuse a phrase and still leave nothing behind to undo, so
    // going back from it needs no warning and no cleanup.
    const origin = await newcomer(19)
    const checker = await newcomer(20)

    try {
      await origin.client.createAccount()
      const words = await origin.client.getSeedMnemonic()

      await checker.client.checkRecoveryPhrase(words)
      expect((await checker.client.getAccountInfo()).haveAccount).toBe(false)

      // And the phrase it accepted is then a phrase that restores. The check is the restore's own
      // decode with the result discarded, so these two answers cannot come apart.
      await checker.client.restoreAccount({ words })
      expect((await checker.client.getAccountInfo()).sessionId).toBe(
        (await origin.client.getAccountInfo()).sessionId,
      )
    } finally {
      await origin.dispose()
      await checker.dispose()
    }
  })

  it('refuses the same phrases the restore would, and by the same names', async () => {
    const origin = await newcomer(21)
    const checker = await newcomer(22)

    try {
      await origin.client.createAccount()
      const words = await origin.client.getSeedMnemonic()

      const misspelt = [...words]
      misspelt[0] = 'zzzzz'
      const unknownWord = await checker.client
        .checkRecoveryPhrase(misspelt)
        .catch((e: unknown) => e)
      expect(String(unknownWord)).toContain('zzzzz')

      const swapped = [...words]
      const [a, b] = [swapped[0], swapped[1]]
      if (a === undefined || b === undefined) throw new Error('a phrase this short cannot happen')
      swapped[0] = b
      swapped[1] = a
      const badChecksum = await checker.client.checkRecoveryPhrase(swapped).catch((e: unknown) => e)
      expect(String(badChecksum)).toMatch(/checksum/i)

      // Half a phrase. libsession takes 12, 13, 24 or 25 words and refuses every other length
      // before it looks a single word up, which is the rule the fake mirrors.
      const halfOfIt = await checker.client
        .checkRecoveryPhrase(words.slice(0, 7))
        .catch((e: unknown) => e)
      expect(halfOfIt).toBeInstanceOf(Error)

      expect((await checker.client.getAccountInfo()).haveAccount).toBe(false)
    } finally {
      await origin.dispose()
      await checker.dispose()
    }
  })

  it('refuses a seed it cannot read, leaving the account unmade', async () => {
    // The restore screen shows the phrase back with an error on it, which is only possible if a
    // refusal leaves the flow where it was rather than half an account behind.
    const { client, dispose } = await newcomer(14)

    try {
      await expect(client.restoreAccount({ hexSeed: 'nonsense' })).rejects.toThrow(/hexSeed/)

      const info = await client.getAccountInfo()
      expect(info.haveAccount).toBe(false)
    } finally {
      await dispose()
    }
  })
})
