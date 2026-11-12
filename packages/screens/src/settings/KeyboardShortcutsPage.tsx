import { ELEMENT } from '@session/test-ids'
import {
  KeyCombo,
  SettingsGroup,
  SettingsRow,
  SettingsSection,
  YStack,
  type KeyNames,
} from '@session/ui'

import { keyboardShortcuts } from '../keyboardShortcuts'

/** The list's modal screen, wherever it was opened from: the menu command closes it. */
export const KEYBOARD_SHORTCUTS_SCREEN = 'keyboard-shortcuts'

/** The keys the app handles, named as this platform's keyboards print them. */
export function KeyboardShortcutsPage({ names }: { names: KeyNames }) {
  return (
    <YStack padding="$md" gap="$lg" testID={ELEMENT.keyboardShortcuts.page}>
      {keyboardShortcuts(names).map((group) => (
        <YStack key={group.name}>
          <SettingsSection label={group.title} />
          <SettingsGroup>
            {group.shortcuts.map((shortcut) => (
              <SettingsRow
                key={shortcut.name}
                label={shortcut.label}
                wideTrailing
                trailing={
                  // A line each, so two ways to do it never read as one combination.
                  <YStack gap="$2xs" alignItems="flex-end">
                    {shortcut.combos.map((keys, index) => (
                      <KeyCombo
                        key={keys.join('+')}
                        keys={keys}
                        names={names}
                        testID={ELEMENT.keyboardShortcuts.combo(shortcut.name, index)}
                      />
                    ))}
                  </YStack>
                }
                testID={ELEMENT.keyboardShortcuts.row(shortcut.name)}
              />
            ))}
          </SettingsGroup>
        </YStack>
      ))}
    </YStack>
  )
}
