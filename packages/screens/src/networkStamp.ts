import type { NetworkName } from '@session/app'

/**
 * Whether a build should say which network it is on.
 *
 * Mainnet is the one that says nothing: it is what a real build is, and stamping it would put a
 * badge across every screenshot anybody ever takes. Everything else says so, loudly, because a
 * devnet or testnet build that looks exactly like a real one is one people mistake for a real one.
 *
 * A function of its own so the rule can be tested. The component around it is JSX, and this
 * package has no render harness - importing it into a test pulls tamagui through a transform that
 * cannot parse it.
 */
export function shouldStampNetwork(name: NetworkName): boolean {
  return name !== 'mainnet'
}
