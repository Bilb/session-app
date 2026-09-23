import { PRIMARY_COLOR_HEX } from '@session/theme-tokens'
import { XStack } from 'tamagui'

import { Text } from './Text'
import { offScaleText } from './textHeight'

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

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0]?.[0] ?? ''
  const second = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + second).toUpperCase()
}

/**
 * How large the initials are against the circle: the desktop client's `AvatarPlaceHolder`, which
 * sizes them from the diameter rather than from the type ramp, so an avatar reads the same at any
 * size. A single letter is larger, having the width of two to itself.
 */
const INITIALS_RATIO = { one: 0.5, more: 0.4 } as const

export interface AvatarProps {
  id: string
  name: string
  size?: number
  testID?: string
}

export function Avatar({ id, name, size = 40, testID }: AvatarProps) {
  const letters = initials(name)
  const fontSize = Math.floor(size * INITIALS_RATIO[letters.length > 1 ? 'more' : 'one'])
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
      <Text {...offScaleText(fontSize)} weight="bold" color="#000000">
        {letters}
      </Text>
    </XStack>
  )
}
