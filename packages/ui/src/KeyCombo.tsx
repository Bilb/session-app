import { XStack, YStack } from 'tamagui'

import { SIZE_SCALE } from './scales'
import { Text } from './Text'

/** Whether keys are named as a Mac's keyboard prints them, or as a PC's. */
export type KeyNames = 'mac' | 'pc'

/**
 * A key, by what it does rather than what it is called. `mod` is the key a shortcut is held with:
 * Command on a Mac, Control elsewhere. `ctrl` is Control on both.
 */
export type KeyName =
  | 'mod'
  | 'ctrl'
  | 'shift'
  | 'alt'
  | 'up'
  | 'down'
  | 'menu'
  | 'f'
  | 'f10'
  | 'f11'
  | 'plus'
  | 'minus'
  | 'zero'
  | 'slash'

/** Legends as the keyboards print them, which no locale translates; the catalogue has none. */
const SHARED: Record<Exclude<KeyName, 'mod' | 'ctrl' | 'shift' | 'alt'>, string> = {
  up: '↑',
  down: '↓',
  menu: 'Menu',
  f: 'F',
  f10: 'F10',
  f11: 'F11',
  plus: '+',
  minus: '-',
  zero: '0',
  slash: '/',
}

const LEGENDS: Record<KeyNames, Record<KeyName, string>> = {
  mac: { ...SHARED, mod: '⌘', ctrl: '⌃', shift: '⇧', alt: '⌥' },
  pc: { ...SHARED, mod: 'Ctrl', ctrl: 'Ctrl', shift: 'Shift', alt: 'Alt' },
}

export interface KeyComboProps {
  /** Held together, in the order they are pressed. */
  keys: readonly KeyName[]
  names: KeyNames
  testID: string
}

/**
 * One key combination, a cap per key.
 *
 * Left to right in every language, as the keys are pressed and as each platform's own menus print
 * them. Caps with no `+` between them: `Ctrl` `+` `+` would make the separator a key.
 */
export function KeyCombo({ keys, names, testID }: KeyComboProps) {
  return (
    <XStack direction="ltr" gap="$2xs" testID={testID}>
      {keys.map((key) => (
        <YStack
          key={key}
          minWidth={SIZE_SCALE.lg}
          minHeight={SIZE_SCALE.lg}
          paddingHorizontal="$xs"
          alignItems="center"
          justifyContent="center"
          borderRadius="$sm"
          borderWidth={1}
          borderColor="$bordersColor"
          backgroundColor="$backgroundNested"
        >
          <Text size="$caption" weight="semibold">
            {LEGENDS[names][key]}
          </Text>
        </YStack>
      ))}
    </XStack>
  )
}
