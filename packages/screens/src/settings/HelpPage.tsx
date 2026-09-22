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
        <SettingsSection
          label={tr('helpReportABug')}
          description={tr('helpReportABugExportLogsSaveToDesktopDescription')}
        />
        {/* A call to action under its explanation, not a row: there is nowhere to navigate to
            and nothing to show on the other side, which is what a row is for.

            Disabled because the app keeps no log file to export -- libsession's own lines reach a
            console and nothing retains them. Drawn anyway, because an export that silently
            produced an empty file would be worse than one that does nothing. */}
        <Button variant="outline" disabled testID={ELEMENT.help.exportLogs}>
          {tr('helpReportABugExportLogs')}
        </Button>
      </YStack>

      <SettingsGroup>
        {LINKS.map((link) => (
          <SettingsRow
            key={link.name}
            label={tr(link.label)}
            subtitle={tr(link.description)}
            trailing={<Icon name="externalLink" size="md" color="$textSecondary" />}
            testID={ELEMENT.help.link(link.name)}
            onPress={() => {
              confirmLink(modals, link.url)
            }}
          />
        ))}
      </SettingsGroup>
    </YStack>
  )
}
