import { ConversationListScreen, useLocale } from '@session/screens'
import { Text, useMedia, YStack } from '@session/ui'

// TODO: a stand-in until the empty detail pane gets legacy Desktop's no-selection state.
// Replace this whole component with that screen, not just its words.
function Placeholder() {
  return (
    <YStack flex={1} alignItems="center" justifyContent="center">
      <Text tone="secondary">Choose a conversation</Text>
    </YStack>
  )
}

/**
 * The list on a phone, where it is the whole screen. On a tablet the shell keeps the list beside
 * the routes (see `src/shell.tsx`), so this pane is the one beside it, with nothing open yet.
 *
 * The launch screen, onboarding and a failed start are the shell's, ahead of every route.
 */
export default function IndexRoute() {
  useLocale()
  const media = useMedia()
  return media.gtSm ? <Placeholder /> : <ConversationListScreen />
}
