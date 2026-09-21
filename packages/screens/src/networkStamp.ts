import type { NetworkName } from '@session/basic-types'

/**
 * Whether a build should say which network it is on.
 *
 * Mainnet is the one that stays silent, because it is what a real build is and a badge over it
 * would land in every screenshot. Everything else says so: a devnet, testnet or fake build that
 * looks like a real one gets treated as one.
 *
 * Split out of the component so the rule can be tested at all: this package has no render harness,
 * and importing the JSX pulls tamagui through a transform that cannot parse it.
 */
export function shouldStampNetwork(name: NetworkName): boolean {
  return name !== 'mainnet'
}

/** What the badge should say, or null when there is nothing worth saying. */
export function networkStampLabel(name: NetworkName): string | null {
  if (name === 'fake') return 'Fake'
  return shouldStampNetwork(name) ? name : null
}
