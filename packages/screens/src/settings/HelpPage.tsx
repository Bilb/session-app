import { URLS } from '@session/app'
import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import {
  Button,
  Icon,
  SettingsGroup,
  SettingsRow,
  SettingsSection,
  useModals,
  YStack,
} from '@session/ui'

import { confirmLink } from './confirmLink'

/**
 * In the desktop client's order. `feedback` goes to `URLS.survey`, not `URLS.feedback`, matching
 * the client so support answers about "the feedback link" hold on both.
 */
const LINKS = [
  { name: 'faq', label: 'helpFAQ', description: 'helpFAQDescription', url: URLS.faq },
  {
    name: 'translate',
    label: 'translate',
    description: 'helpTranslateSessionDescription',
    url: URLS.translate,
  },
  { name: 'feedback', label: 'feedback', description: 'feedbackDescription', url: URLS.survey },
  { name: 'support', label: 'helpSupport', description: 'supportDescription', url: URLS.support },
] as const

/** Help: report a bug, and four links. A child screen; the settings modal supplies the chrome. */
export function HelpPage() {
  const modals = useModals()

  return (
    <YStack padding="$md" gap="$lg">
      <YStack>
        <SettingsSection label={tr('logs')} />
        <SettingsGroup>
          {/* Disabled: the app keeps no log file, as libsession's lines go only to a console. */}
          <SettingsRow
            label={tr('helpReportABug')}
            subtitle={tr('helpReportABugExportLogsSaveToDesktopDescription')}
            trailing={
              <Button variant="outline" size="sm" disabled testID={ELEMENT.help.exportLogs}>
                {tr('helpReportABugExportLogs')}
              </Button>
            }
            testID={ELEMENT.help.reportABug}
          />
        </SettingsGroup>
      </YStack>

      <YStack>
        <SettingsSection label={tr('links')} />
        <SettingsGroup>
          {LINKS.map((link) => (
            <SettingsRow
              key={link.name}
              label={tr(link.label)}
              subtitle={tr(link.description)}
              // The accent on dark, body text on light: the client's pairing for this glyph.
              trailing={<Icon name="externalLink" size="md" color="$accentText" />}
              testID={ELEMENT.help.link(link.name)}
              onPress={() => {
                confirmLink(modals, link.url)
              }}
            />
          ))}
        </SettingsGroup>
      </YStack>
    </YStack>
  )
}
