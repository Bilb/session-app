import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { Button, Modal, Text } from '@session/ui'

interface QuitWarningModalProps {
  open: boolean
  onQuit: () => void
  onCancel: () => void
}

/**
 * "You cannot go back further."
 *
 * Shown where back has nowhere to go *and* something has already been made that leaving would
 * abandon. In 2.0 that is one place only: the name screen a failed restore lands on, where the
 * account already exists because the phrase had to be checked against libsession to be accepted.
 *
 * **Not shown when creating.** The desktop client shows it there too, because it generates and
 * stores a recovery password the moment its name screen mounts. 2.0 holds the name in the flow's
 * own state and mints nothing until the last step, so backing out of create genuinely costs
 * nothing -- which is the model iOS uses and the one preferred here. Putting the dialog there
 * would be warning about a loss that cannot happen.
 */
export function QuitWarningModal({ open, onQuit, onCancel }: QuitWarningModalProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={tr('warning')}
      closeLabel={tr('close')}
      testID={ELEMENT.onboarding.quitDialog}
      closeTestID={ELEMENT.onboarding.quitCancel}
      actions={
        <>
          <Button
            variant="simple"
            destructive
            testID={ELEMENT.onboarding.quitConfirm}
            onPress={onQuit}
          >
            {tr('quitButton')}
          </Button>
          <Button variant="simple" testID={ELEMENT.onboarding.quitCancel} onPress={onCancel}>
            {tr('cancel')}
          </Button>
        </>
      }
    >
      <Text size="$body" textAlign="center">
        {tr('onboardingBackLoadAccount')}
      </Text>
    </Modal>
  )
}
