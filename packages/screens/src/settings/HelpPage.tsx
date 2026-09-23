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
 * The four addresses Help offers, in the desktop client's order.
 *
 * **The label and the address do not always agree, and the client's pairing is kept.** `feedback`
 * goes to the survey page, not to `URLS.feedback` -- the catalogue has one word for it and
 * libsession carries two addresses, and following the client is what keeps a support answer that
 * says "the feedback link" true on both.
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

/**
 * Help: report a bug, and the four places to go for everything else.
 *
 * A child screen of the settings modal, which supplies the title and the back control -- so there
 * is no chrome here at all.
 *
 * **Every link leaves through a confirmation**, as the client's do: the app never hands an address
 * to the browser without showing it first.
 */
export function HelpPage() {
  const modals = useModals()

  return (
    <YStack padding="$md" gap="$lg">
      <YStack>
        <SettingsSection label={tr('logs')} />
        <SettingsGroup>
          {/* One row with its action on the trailing side, as the client draws it: the row says
              what the export is for, and the button is the only thing on it to press.

              The button is disabled because the app keeps no log file to export -- libsession's
              own lines reach a console and nothing retains them. Drawn anyway, because an export
              that silently produced an empty file would be worse than one that does nothing. */}
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
              // `accentText`, which is the accent on a dark ground and the body text on a light
              // one -- the client's own pairing for this glyph.
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
