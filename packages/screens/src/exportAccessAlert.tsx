import { requirePorts, type ExportAccess } from '@session/app'
import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { Button, type Modals } from '@session/ui'

import { LocalizedText } from './LocalizedText'

function AccessActions({ modals, id }: { modals: Modals; id: string }) {
  const openSettings = requirePorts().linking.openAppSettings
  return (
    <>
      {openSettings === null ? null : (
        <Button
          variant="ghost"
          fill
          borderRadius="$none"
          testID={ELEMENT.conversation.exportAccessSettings}
          onPress={() => {
            modals.dismiss(id)
            void openSettings()
          }}
        >
          {tr('sessionSettings')}
        </Button>
      )}
      <Button
        variant="ghost"
        fill
        borderRadius="$none"
        testID={ELEMENT.conversation.exportAccessCancel}
        onPress={() => {
          modals.dismiss(id)
        }}
      >
        {tr('cancel')}
      </Button>
    </>
  )
}

/**
 * Says why an export cannot go where it should, once the OS has stopped asking: the access can
 * now only be granted from the app's page in the system settings, which this offers to open.
 */
export function explainExportAccessRefused(modals: Modals, access: ExportAccess): void {
  const id = modals.present({
    kind: 'alert',
    testID: ELEMENT.conversation.exportAccessDialog,
    showClose: false,
    initial: {
      title: tr('permissionsRequired'),
      render: () => (
        <LocalizedText
          text={tr(access === 'storage' ? 'permissionsStorageDeniedLegacy' : 'permissionsLibrary')}
          size="$body"
          textAlign="center"
        />
      ),
      footer: () => <AccessActions modals={modals} id={id} />,
    },
  })
}
