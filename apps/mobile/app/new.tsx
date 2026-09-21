import { NewConversationScreen, useLocale } from '@session/screens'

/** The route file is the boundary: the screen itself never reads a router. */
export default function NewConversationRoute() {
  useLocale()
  return <NewConversationScreen />
}
