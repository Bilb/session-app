import { isWeb } from 'tamagui'

/** The name a screen reader's action for replying is given, on a message row. */
const REPLY_ACTION = 'reply'

/**
 * Reply as an accessibility action, for the accessible element of a message row: a swipe is out of
 * reach under VoiceOver and TalkBack. Nothing on the web, where the message menu offers it.
 */
export function replyAction(label: string, onReply: () => void) {
  if (isWeb) return {}
  return {
    accessibilityActions: [{ name: REPLY_ACTION, label }],
    onAccessibilityAction: (event: { nativeEvent: { actionName: string } }) => {
      if (event.nativeEvent.actionName === REPLY_ACTION) onReply()
    },
  } as const
}
