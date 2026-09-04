import { PRIMARY_COLOR_HEX } from '@s2/theme-tokens'
import { XStack } from 'tamagui'

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

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0]?.[0] ?? ''
  const second = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + second).toUpperCase()
}

export interface AvatarProps {
  id: string
  name: string
  size?: number
  testID?: string
}

export function Avatar({ id, name, size = 40, testID }: AvatarProps) {
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
      <Text size={size >= 40 ? '$4' : '$2'} weight="bold" color="#000000">
        {initials(name)}
      </Text>
    </XStack>
  )
}
