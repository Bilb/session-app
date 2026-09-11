import { useMemo, useState } from 'react'
import { ScrollView, XStack, YStack } from 'tamagui'

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

  const matches = useMemo(() => filterLanguages(options, query), [options, query])

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
        <ScrollView maxHeight={maxHeight} keyboardShouldPersistTaps="handled">
          <YStack>
            {matches.map((option) => {
              const selected = option.value === value
              return (
                <XStack
                  key={option.value}
                  role="button"
                  alignItems="center"
                  gap="$1.5"
                  paddingVertical="$1.5"
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
