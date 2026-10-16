import { useEffect, useState } from 'react'
import { AccessibilityInfo } from 'react-native'
import { isWeb, YStack } from 'tamagui'

import { Text } from './Text'

export interface AnnouncementProps {
  /** Said once per `announceKey`; nothing while empty. */
  text: string
  /** Changes with each event worth saying, so the same words twice are said twice. */
  announceKey: number
}

/**
 * Undrawn but in the accessibility tree, which `display: none` is not. Fixed, so it takes no place
 * in its parent's layout and needs no containing block.
 */
const VISUALLY_HIDDEN = { clipPath: 'inset(50%)', whiteSpace: 'nowrap' } as const

/**
 * Says something to a screen reader without drawing it, once per key.
 *
 * Held at the key's words: the words changing under the same key, as when one of several notices
 * is dismissed, is not something new to say.
 */
export function Announcement({ text, announceKey }: AnnouncementProps) {
  const [said, setSaid] = useState({ key: announceKey, text })
  if (said.key !== announceKey) setSaid({ key: announceKey, text })

  // Neither mobile screen reader announces a view that merely appears.
  useEffect(() => {
    if (!isWeb && said.text !== '') AccessibilityInfo.announceForAccessibility(said.text)
  }, [said])

  if (!isWeb || said.text === '') return null
  return (
    // Remounted per key: a live region whose words do not change is not announced again.
    <YStack
      key={said.key}
      role="alert"
      position="fixed"
      width={1}
      height={1}
      overflow="hidden"
      style={VISUALLY_HIDDEN}
    >
      <Text>{said.text}</Text>
    </YStack>
  )
}
