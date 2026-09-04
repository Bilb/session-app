import { ConversationListScreen } from '@session/screens'

/**
 * The list. On a phone this is the whole screen and a conversation pushes over it; on a
 * tablet AdaptiveShell keeps it beside the detail. Neither is decided here.
 */
export default function IndexRoute() {
  return <ConversationListScreen />
}
