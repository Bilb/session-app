import { YStack } from '@session/ui'

import { AttachmentCacheSection } from './AttachmentCacheSection'

/**
 * Conversations: settings about conversations in general rather than any one of them. A child
 * screen; the settings modal supplies the chrome.
 *
 * For now only the attachment cache. TODO: the rows the shipping clients have here -- message
 * trimming, audio messages, blocked contacts -- come with this page's own work.
 */
export function ConversationsPage() {
  return (
    <YStack padding="$md" gap="$lg">
      <AttachmentCacheSection />
    </YStack>
  )
}
