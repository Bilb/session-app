import { XStack, YStack } from 'tamagui'

import { PressArea } from './PressArea'
import { Text } from './Text'

/**
 * The bar of tabs across the top of a screen that has more than one way in.
 *
 * **The legacy client's own metrics.** 48 tall with a hairline under the whole bar, the label bold
 * and centred, and the chosen tab marked by a thick bar along its bottom edge rather than by a
 * change of colour -- 5 points of the accent, inset a little at each end so it reads as belonging
 * to the tab rather than as a continuation of the hairline.
 *
 * Generic in the tabs it is given rather than knowing about any screen: the clients draw it the
 * same way wherever they use it.
 */
const BAR_HEIGHT = 48
const INDICATOR_HEIGHT = 5
/** `verySmallSpacing`. What keeps one tab's indicator from meeting its neighbour's. */
const INDICATOR_INSET = 4

export interface TopTab {
  /** Identifies the tab to whoever is holding the state. Never shown. */
  key: string
  label: string
  testID?: string
}

export interface TopTabsProps {
  tabs: TopTab[]
  active: string
  onChange: (key: string) => void
}

export function TopTabs({ tabs, active, onChange }: TopTabsProps) {
  return (
    <XStack
      height={BAR_HEIGHT}
      borderBottomWidth={1}
      borderBottomColor="$bordersColor"
      alignItems="stretch"
    >
      {tabs.map((tab) => (
        <PressArea
          key={tab.key}
          fill
          {...(tab.testID === undefined ? {} : { testID: tab.testID })}
          accessibilityLabel={tab.label}
          onPress={() => {
            onChange(tab.key)
          }}
        >
          {() => (
            <YStack flex={1} alignItems="center" justifyContent="flex-end" gap="$1">
              {/* 17 on iOS, bold. The label keeps the text colour in both states: the bar
                  underneath is the whole signal, which is how the client draws it. */}
              <Text size="$bodyLarge" weight="bold">
                {tab.label}
              </Text>
              <YStack
                height={INDICATOR_HEIGHT}
                alignSelf="stretch"
                marginHorizontal={INDICATOR_INSET}
                backgroundColor={tab.key === active ? '$primaryColor' : 'transparent'}
              />
            </YStack>
          )}
        </PressArea>
      ))}
    </XStack>
  )
}
