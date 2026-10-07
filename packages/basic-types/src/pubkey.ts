const prefixStandard = '05' as const
const prefixGroup = '03' as const

export type GroupPubkeyType = `${typeof prefixGroup}${string}`
export type PubkeyType = `${typeof prefixStandard}${string}`

export type WithGroupPubkey = { groupPk: GroupPubkeyType }
export type WithSessionID = { sessionId: PubkeyType }
export type WithPubkey<T extends PubkeyType | GroupPubkeyType> = {
  pubkey: T
}

export const PubkeyPrefix = {
  standard: prefixStandard,
  group: prefixGroup,
}

/**
 * Every prefix an account ID can start with. Each says what kind of key follows rather than whose:
 * a standard account, a group, a community-blinded one (15, 25) or an unblinded one (00).
 */
export const AccountIdPrefix = {
  ...PubkeyPrefix,
  blinded15: '15',
  blinded25: '25',
  unblinded: '00',
} as const

const ACCOUNT_ID_LIKE = new RegExp(
  `^(${Object.values(AccountIdPrefix).join('|')})[0-9a-f]{2,}$`,
  'i',
)

/**
 * Whether text looks like an account ID: one of its prefixes, then hex.
 *
 * **Looks like, not is.** Deliberately loose -- any length past the prefix -- because it spots a
 * display name that is an ID, where a truncated one counts too. Not a validator: `is05Pubkey` and
 * `is03Pubkey` check the real shape.
 */
export function looksLikeAccountId(text: string): boolean {
  return ACCOUNT_ID_LIKE.test(text)
}

type PubkeyPrefixT = typeof PubkeyPrefix

export type PubkeyPrefixType = PubkeyPrefixT[keyof PubkeyPrefixT]

const HEX = '[0-9a-fA-F]'

export function is05Pubkey(key: string): key is PubkeyType {
  const regex = new RegExp(`^${PubkeyPrefix.standard}${HEX}{64}$`)
  return regex.test(key)
}

export function is03Pubkey(key: string): key is GroupPubkeyType {
  const regex = new RegExp(`^${PubkeyPrefix.group}${HEX}{64}$`)
  return regex.test(key)
}

function isValidPrefixAndLength(keyWithOrWithoutPrefix: string): boolean {
  return (
    keyWithOrWithoutPrefix.length === 66 &&
    // keyWithOrWithoutPrefix.startsWith(KeyPrefixType.blinded15) ||
    // keyWithOrWithoutPrefix.startsWith(KeyPrefixType.blinded25) ||
    (keyWithOrWithoutPrefix.startsWith(PubkeyPrefix.standard) ||
      keyWithOrWithoutPrefix.startsWith(PubkeyPrefix.group))
  )
}

export function removePrefixIfNeeded(keyWithOrWithoutPrefix: string): string {
  if (isValidPrefixAndLength(keyWithOrWithoutPrefix)) {
    const keyWithoutPrefix = keyWithOrWithoutPrefix.substr(2)
    return keyWithoutPrefix
  }
  return keyWithOrWithoutPrefix
}

export function shortenPk(toShorten: string) {
  if (toShorten.length < 6) {
    return `(${toShorten})`
  }
  return `(${toShorten.substr(0, 2)}...${toShorten.substr(toShorten.length - 4)})`
}
