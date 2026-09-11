import { useEffect, useMemo, useRef, useState } from 'react'
import { ScrollView, XStack, YStack } from 'tamagui'
import type { ElementRef } from 'react'

import { Icon } from './Icon'
import { filterLanguages } from './languageFilter'
import { Input } from './Input'
import { Text } from './Text'
import type { LanguageChoice, LanguagePickerTestIDs } from './LanguagePicker.types'

interface LanguageChoiceListProps {
  value: string
  options: readonly LanguageChoice[]
  onChange: (value: string) => void
  searchPlaceholder: string
  emptyLabel: string
  /** How tall the scrolling area may grow. A dropdown and a sheet want different answers. */
  maxHeight: number
  testIDs: Pick<LanguagePickerTestIDs, 'search' | 'option'>
}

/**
 * The searchable list of languages.
 *
 * Split out from the picker rather than written inline because the picker shows it only on the
 * branch where the app owns the setting, and that branch already has enough going on around it:
 * a panel, a backdrop and the decision about which branch to take. This is the part that just
 * lists languages.
 */
/**
 * Fixed, so the selected row can be scrolled to by arithmetic rather than by measuring every row
 * above it. Tall enough for a comfortable target and for the scripts with tall ascenders.
 */
const ROW_HEIGHT = 40

export function LanguageChoiceList({
  value,
  options,
  onChange,
  searchPlaceholder,
  emptyLabel,
  maxHeight,
  testIDs,
}: LanguageChoiceListProps) {
  const [query, setQuery] = useState('')
  const scroller = useRef<ElementRef<typeof ScrollView>>(null)

  const matches = useMemo(() => filterLanguages(options, query), [options, query])

  /**
   * Opens with the current language in view.
   *
   * Scrolled to rather than pinned to the top, which is what a native `<select>` does and what a
   * person scanning an alphabetical list expects: moving the selected row out of its alphabetical
   * place makes the list harder to scan for everyone in order to help the one row that is already
   * marked with a tick.
   *
   * Nudged up by one row so there is something above it -- a selected row flush against the top
   * edge looks like the start of the list rather than a position within it.
   */
  useEffect(() => {
    const index = matches.findIndex((option) => option.value === value)
    if (index < 0) return
    scroller.current?.scrollTo({ y: Math.max(0, (index - 1) * ROW_HEIGHT), animated: false })
    // Deliberately empty: this runs once, when the panel opens. Re-running it as somebody types
    // would drag the list back to the selected row after every keystroke.
  }, [])

  return (
    <YStack gap="$1">
      <XStack alignItems="center" gap="$1">
        <Icon name="search" size="$4" color="$textSecondary" />
        <Input
          grow
          value={query}
          onChangeText={setQuery}
          placeholder={searchPlaceholder}
          autoCapitalize="none"
          testID={testIDs.search}
        />
      </XStack>

      {matches.length === 0 ? (
        <YStack paddingVertical="$2" alignItems="center">
          <Text tone="secondary" size="$body">
            {emptyLabel}
          </Text>
        </YStack>
      ) : (
        <ScrollView ref={scroller} maxHeight={maxHeight} keyboardShouldPersistTaps="handled">
          <YStack>
            {matches.map((option) => {
              const selected = option.value === value
              return (
                <XStack
                  key={option.value}
                  role="button"
                  alignItems="center"
                  gap="$1.5"
                  height={ROW_HEIGHT}
                  paddingHorizontal="$1.5"
                  borderRadius="$1"
                  cursor="pointer"
                  backgroundColor={selected ? '$backgroundTertiary' : 'transparent'}
                  pressStyle={{ backgroundColor: '$backgroundTertiary' }}
                  onPress={() => {
                    onChange(option.value)
                  }}
                  aria-selected={selected}
                  testID={testIDs.option(option.value)}
                >
                  {/* The flag is decoration: it repeats across rows and is absent on three of
                      them, so it is hidden from screen readers and the name carries the row. */}
                  <Text size="$title" aria-hidden>
                    {option.flag}
                  </Text>
                  <Text flex={1} size="$body" weight={selected ? 'semibold' : 'regular'}>
                    {option.label}
                  </Text>
                  {selected ? <Icon name="check" size="$4" color="$primaryColor" /> : null}
                </XStack>
              )
            })}
          </YStack>
        </ScrollView>
      )}
    </YStack>
  )
}
