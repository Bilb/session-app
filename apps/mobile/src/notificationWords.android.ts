import { subscribeLocale, tr } from '@session/localization'
import { requireOptionalNativeModule } from 'expo'

const SessionPush = requireOptionalNativeModule<{
  setStrings(strings: Record<string, string>): void
}>('SessionPush')

/** What `modules/session-push` builds a notification from, by its names (`PushStrings.kt`). */
function words(): Record<string, string> {
  return {
    appName: tr('appName'),
    channel: tr('notificationsMessage'),
    generic: tr('messageNewYouveGot', { count: 1 }),
    request: tr('messageRequestsNew'),
    you: tr('you'),
    image: tr('image'),
    animated: tr('gif'),
    video: tr('video'),
    audio: tr('audio'),
    voice: tr('messageVoice'),
    file: tr('document'),
    attachments: tr('attachments'),
  }
}

/**
 * Keeps the native push handler's words in the person's language: it posts notifications while
 * the app is not running, where the catalogue is out of reach.
 */
export function followNotificationWords(): void {
  if (SessionPush === null) return
  const save = () => {
    SessionPush.setStrings(words())
  }
  save()
  subscribeLocale(save)
}
