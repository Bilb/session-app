import { COLORS, PRIMARY_COLOR_HEX } from '@session/theme-tokens'
import { XStack } from 'tamagui'

import { avatarInitials } from './avatarInitials'
import { rampSizeAtMost } from './rampSize'
import { Text } from './Text'

/**
 * Initials on a colour derived from the id, until a display picture is fetched.
 *
 * The colour comes from the account id rather than the name, so it stays put when someone
 * changes their display name or is given a nickname.
 */
const ACCENTS = Object.values(PRIMARY_COLOR_HEX)

function colorFor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return ACCENTS[hash % ACCENTS.length] ?? ACCENTS[0] ?? '#31F196'
}

/** Initials scale with the diameter; one letter gets more room. */
const INITIALS_RATIO = { one: 0.5, more: 0.4 } as const

export interface AvatarProps {
  id: string
  name: string
  size?: number
  testID?: string
}

export function Avatar({ id, name, size = 40, testID }: AvatarProps) {
  const letters = avatarInitials(name, id)
  const initialsSize = rampSizeAtMost(size * INITIALS_RATIO[letters.length > 1 ? 'more' : 'one'])
  return (
    <XStack
      width={size}
      height={size}
      borderRadius={size / 2}
      backgroundColor={colorFor(id)}
      alignItems="center"
      justifyContent="center"
      testID={testID}
    >
      {/* White: the circle is the account's colour, not the theme's, so no theme role fits. */}
      <Text size={`$${initialsSize}`} weight="bold" color={COLORS.WHITE}>
        {letters}
      </Text>
    </XStack>
  )
}
