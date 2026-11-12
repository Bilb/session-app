import { YStack } from 'tamagui'

import { Button } from '../../Button'
import { Swap } from '../../Swap'
import { Text } from '../../Text'
import { defineStory } from '../story'
import { noop } from './shared'

/**
 * What a swap settles to, in a centring column as the recovery password draws it: the block takes
 * the column's width. The move between two blocks is not something a picture shows.
 */
export const swap = defineStory<{ tall: boolean }>({
  component: 'swap',
  story: 'settled',
  width: 390,
  sensitive: { rtl: true },
  variants: { short: { tall: false }, tall: { tall: true } },
  render: ({ tall }) => (
    <YStack alignItems="center" padding="$md" backgroundColor="$backgroundSecondary">
      <Swap swapKey={tall ? 'tall' : 'short'} instant>
        <YStack gap="$md" alignItems="center">
          <Text size="$body">
            {tall ? 'A taller block, with a second line of text in it' : 'A block'}
          </Text>
          {tall ? <Text size="$body">and a third</Text> : null}
          <Button variant="outline" fill testID="catalog-swap-button" onPress={noop}>
            Swap
          </Button>
        </YStack>
      </Swap>
    </YStack>
  ),
})
