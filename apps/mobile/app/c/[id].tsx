import { ConversationScreen, useLocale } from '@session/screens'
import { useLocalSearchParams } from 'expo-router'

/**
 * expo-router puts the id in the path; reading it out is this file's whole job, so the
 * screen itself never has to know which router it is running under.
 */
export default function ConversationRoute() {
  useLocale()
  const { id } = useLocalSearchParams<{ id: string }>()
  if (id === undefined) return null
  return <ConversationScreen conversationId={decodeURIComponent(id)} />
}
