import { tr } from '@session/localization'
import { ELEMENT, type ElementId } from '@session/test-ids'
import { Icon, PressArea, Sheet, Text, XStack, type IconName } from '@session/ui'

function MenuRow({
  icon,
  label,
  onPress,
  testID,
}: {
  icon: IconName
  label: string
  onPress: () => void
  testID: ElementId
}) {
  return (
    <PressArea onPress={onPress} accessibilityLabel={label} testID={testID}>
      {() => (
        <XStack alignItems="center" gap="$md" paddingVertical="$sm" minHeight={52}>
          <Icon name={icon} size="md" color="$textPrimary" />
          <Text size="$bodyLarge">{label}</Text>
        </XStack>
      )}
    </PressArea>
  )
}

/**
 * Which system picker + opens, on a phone or a tablet.
 *
 * Two, because the photo library and the file browser are two pickers on both mobile systems.
 * There is no camera row: nothing here can take a picture yet.
 */
export function AttachMenu({
  open,
  onClose,
  onMedia,
  onDocument,
}: {
  open: boolean
  onClose: () => void
  onMedia: () => void
  onDocument: () => void
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={tr('attachmentsAdd')}
      closeLabel={tr('close')}
      testID={ELEMENT.conversation.attachMenu}
      closeTestID={ELEMENT.conversation.attachMenuClose}
      scrimTestID={ELEMENT.conversation.attachMenuScrim}
    >
      <MenuRow
        icon="image"
        label={tr('media')}
        onPress={onMedia}
        testID={ELEMENT.conversation.attachMedia}
      />
      <MenuRow
        icon="file"
        label={tr('document')}
        onPress={onDocument}
        testID={ELEMENT.conversation.attachDocument}
      />
    </Sheet>
  )
}
