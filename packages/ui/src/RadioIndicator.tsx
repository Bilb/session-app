import { YStack } from 'tamagui'

/**
 * The ring a radio draws, and the dot inside it when chosen.
 *
 * **A radio rather than a tick**, which is what both legacy clients use for a one-of-many choice.
 * A tick says "this is done"; a radio says "this one, of these".
 *
 * The two agree on everything but the size: iOS draws a 22pt ring with a 17pt dot, Android a 24dp
 * ring with a 19dp one. Android's are used here, as the tie-break. The ring is the text colour in
 * both states and only the dot appears -- neither client changes the ring or the box on selection,
 * so the dot carries the whole signal.
 */
const SIZE = 24
const RING = 1
const DOT_INSET = 2.5

export function RadioIndicator({ selected }: { selected: boolean }) {
  return (
    <YStack
      width={SIZE}
      height={SIZE}
      borderRadius={SIZE / 2}
      borderWidth={RING}
      borderColor={selected ? '$primaryColor' : '$bordersColor'}
      alignItems="center"
      justifyContent="center"
    >
      {selected ? (
        <YStack
          width={SIZE - DOT_INSET * 2 - RING * 2}
          height={SIZE - DOT_INSET * 2 - RING * 2}
          borderRadius={SIZE / 2}
          backgroundColor="$primaryColor"
        />
      ) : null}
    </YStack>
  )
}
