import { SettingsGroup, SettingsNote, SettingsRow, type SettingsRowProps } from '../../SettingsRow'
import { Text } from '../../Text'
import { defineStory } from '../story'
import { LONG, noop } from './shared'

const ROW = { onPress: noop } as const

export const settingsRow = defineStory<SettingsRowProps>({
  component: 'settingsRow',
  story: 'variants',
  width: 390,
  forced: ['hover', 'press', 'focus'],
  sensitive: { rtl: true, responsive: true, accent: true },
  variants: {
    plain: {
      ...ROW,
      testID: 'catalog-settings-row-plain',
      label: 'Notifications',
      icon: 'bellOff',
    },
    subtitle: {
      ...ROW,
      testID: 'catalog-settings-row-subtitle',
      label: 'Privacy',
      subtitle: 'Read receipts, typing indicators',
      icon: 'lockKeyhole',
    },
    trailing: {
      ...ROW,
      testID: 'catalog-settings-row-trailing',
      label: 'Language',
      icon: 'clock',
      trailing: <Text tone="secondary">English</Text>,
    },
    accentIcon: {
      ...ROW,
      testID: 'catalog-settings-row-accentIcon',
      label: 'Session Pro',
      icon: 'settings',
      accentIcon: true,
    },
    destructive: {
      ...ROW,
      testID: 'catalog-settings-row-destructive',
      label: 'Clear data',
      icon: 'trash',
      destructive: true,
    },
    disabled: {
      ...ROW,
      testID: 'catalog-settings-row-disabled',
      label: 'Notifications',
      icon: 'bellOff',
      disabled: true,
    },
    arabic: {
      ...ROW,
      testID: 'catalog-settings-row-arabic',
      label: 'الإشعارات',
      subtitle: 'إيصالات القراءة ومؤشرات الكتابة',
      icon: 'bellOff',
      trailing: <Text tone="secondary">مفعّل</Text>,
    },
    long: {
      ...ROW,
      testID: 'catalog-settings-row-long',
      label: LONG,
      subtitle: LONG,
      icon: 'clock',
    },
  },
  render: (props) => <SettingsRow {...props} />,
})

/**
 * A note where a row has gone, in a group between two rows, so its height and inset are seen
 * against theirs. The worst case wraps.
 */
export const settingsNote = defineStory<{ text: string }>({
  component: 'settingsRow',
  story: 'note',
  width: 390,
  sensitive: { rtl: true, responsive: true },
  variants: {
    short: { text: 'Recovery Password hidden on this device' },
    arabic: { text: 'تم إخفاء كلمة مرور الاسترداد على هذا الجهاز' },
    long: { text: LONG },
  },
  render: ({ text }) => (
    <SettingsGroup>
      <SettingsRow {...ROW} testID="catalog-settings-note-above" label="Help" icon="circleHelp" />
      <SettingsNote text={text} testID="catalog-settings-note" />
      <SettingsRow
        {...ROW}
        testID="catalog-settings-note-below"
        label="Preferences"
        icon="settings"
      />
    </SettingsGroup>
  ),
})
