import type { NotificationsPort } from '@session/app'
import type { SessionStore } from '@session/state'
import { Linking } from 'react-native'

type NotificationSettings = Pick<
  NotificationsPort,
  | 'soundWhenOpenDefault'
  | 'notificationsAllowed'
  | 'openSettings'
  | 'openChannelSettings'
  | 'backgroundActivity'
  | 'backgroundRefreshOn'
  | 'preview'
>

/**
 * iOS's part of the Notifications page. The permission, Background App Refresh and the preview
 * need the notification work iOS has not had yet, so they are null for now and their rows absent.
 */
export const notificationSettings: NotificationSettings = {
  soundWhenOpenDefault: false,
  notificationsAllowed: null,
  // iOS opens the app's own page in Settings, which is where its notification switches are.
  openSettings: () => {
    void Linking.openSettings()
  },
  openChannelSettings: null,
  backgroundActivity: null,
  backgroundRefreshOn: null,
  preview: null,
}

/** Nothing native to keep in step on iOS yet. */
export function followNotificationPrefs(_store: SessionStore): void {}
