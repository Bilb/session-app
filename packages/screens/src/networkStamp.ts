import type { NetworkName } from '@session/basic-types'

/**
 * Whether a build should say which network it is on.
 *
 * Mainnet is the one that stays silent, because it is what a real build is and a badge over it
 * would land in every screenshot. Everything else says so: a devnet or testnet build that looks
 * like a real one gets treated as one.
 *
 * Split out of the component so the rule can be tested at all: this package has no render harness,
 * and importing the JSX pulls tamagui through a transform that cannot parse it.
 */
export function shouldStampNetwork(name: NetworkName): boolean {
  return name !== 'mainnet'
}

/**
 * What the badge should say, or null when there is nothing worth saying.
 *
 * The fake wins over the network, and deliberately: a fake build on testnet is not on testnet at
 * all, and naming the network there would be the more misleading of the two. A fake build on
 * mainnet still says so, which is the case the plain network rule would have stayed silent about.
 */
export function networkStampLabel(name: NetworkName, usingFake: boolean): string | null {
  if (usingFake) return 'Fake'
  return shouldStampNetwork(name) ? name : null
}
