import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { Button, Input, Text, YStack } from '@session/ui'
import { useState } from 'react'

import { displayNameProblem } from './displayName'
import { OnboardingStep } from './OnboardingStep'

interface PickDisplayNameScreenProps {
  /**
   * Whether a restore gave up on the way here, which changes what the screen says.
   *
   * Not cosmetic. In the ordinary case this is a question; after a failed restore it is an
   * explanation of why the account that was just restored has no name on it, and the person
   * did not ask to be here.
   */
  afterFailedRestore: boolean
  onBack: () => void
  onContinue: (name: string) => void
  busy?: boolean
}

/**
 * Naming the account.
 *
 * Validated on submit rather than as you type: the only two failures are blank and too long, and
 * an error that appears under a field while somebody is still typing into it is telling them off
 * for not having finished.
 */
export function PickDisplayNameScreen({
  afterFailedRestore,
  onBack,
  onContinue,
  busy = false,
}: PickDisplayNameScreenProps) {
  const [name, setName] = useState('')
  const [problem, setProblem] = useState<'empty' | 'tooLong' | null>(null)

  const submit = () => {
    const found = displayNameProblem(name)
    setProblem(found)
    if (found === null) onContinue(name)
  }

  return (
    <OnboardingStep
      title={afterFailedRestore ? tr('displayNameNew') : tr('displayNamePick')}
      description={afterFailedRestore ? tr('displayNameErrorNew') : tr('displayNameDescription')}
      onBack={onBack}
      testID={ELEMENT.onboarding.displayNameScreen}
      footer={
        <Button
          testID={ELEMENT.onboarding.continueButton}
          loading={busy}
          onPress={submit}
          // Not disabled on an empty field: a disabled button gives no reason, and the reason is
          // the entire content of the first error message.
        >
          {tr('theContinue')}
        </Button>
      }
    >
      <YStack gap="$1">
        <Input
          value={name}
          onChangeText={(next) => {
            setName(next)
            // Clears as soon as the field changes, so a correction is not still being told off.
            setProblem(null)
          }}
          placeholder={tr('displayNameEnter')}
          autoCapitalize="words"
          autoFocus
          onSubmit={submit}
          testID={ELEMENT.onboarding.displayNameInput}
        />
        {problem === null ? null : (
          <Text tone="danger" size="$label" testID={ELEMENT.onboarding.displayNameError}>
            {problem === 'empty'
              ? tr('displayNameErrorDescription')
              : tr('displayNameErrorDescriptionShorter')}
          </Text>
        )}
      </YStack>
    </OnboardingStep>
  )
}
