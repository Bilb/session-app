import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { Button, Input, Text, YStack } from '@session/ui'
import { useState } from 'react'

import { OnboardingStep } from './OnboardingStep'
import { phraseIsTooShort, phraseWords } from './recoveryPhrase'
import type { RecoveryInput } from './flow'

interface LoadAccountScreenProps {
  onBack: () => void
  onContinue: (from: RecoveryInput) => void
  /** What the bridge said when it refused the last phrase, or null. */
  rejected?: boolean
  busy?: boolean
}

/**
 * Entering a recovery phrase.
 *
 * **The QR tab the legacy clients have is not here yet.** They offer `sessionRecoveryPassword` and
 * `qrScan` side by side; scanning needs a camera, and this app has no camera port. A tab that
 * opened onto nothing would be worse than its absence, so the phrase is the whole screen until
 * there is something behind the other one.
 */
export function LoadAccountScreen({
  onBack,
  onContinue,
  rejected = false,
  busy = false,
}: LoadAccountScreenProps) {
  const [phrase, setPhrase] = useState('')
  const [tooShort, setTooShort] = useState(false)

  const submit = () => {
    const short = phraseIsTooShort(phrase)
    setTooShort(short)
    if (!short) onContinue({ words: phraseWords(phrase) })
  }

  return (
    <OnboardingStep
      title={tr('sessionRecoveryPassword')}
      description={tr('recoveryPasswordRestoreDescription')}
      onBack={onBack}
      testID={ELEMENT.onboarding.loadAccountScreen}
      footer={
        <Button testID={ELEMENT.onboarding.continueButton} loading={busy} onPress={submit}>
          {tr('theContinue')}
        </Button>
      }
    >
      <YStack gap="$1">
        <Input
          value={phrase}
          onChangeText={(next) => {
            setPhrase(next)
            setTooShort(false)
          }}
          placeholder={tr('recoveryPasswordEnter')}
          // A phrase is a dozen-odd words and wraps; a single line hides most of it while it is
          // being checked over, which is when it is most worth being able to see.
          multiline
          autoCapitalize="none"
          autoFocus
          testID={ELEMENT.onboarding.recoveryPhraseInput}
        />
        {!tooShort && !rejected ? null : (
          <Text tone="danger" size="$label" testID={ELEMENT.onboarding.recoveryPhraseError}>
            {tooShort
              ? tr('recoveryPasswordErrorMessageShort')
              : // Generic rather than "incorrect", because the bridge flattens libsession's
                // several refusals into one message and this cannot tell which it was. See
                // recoveryPhrase.ts.
                tr('recoveryPasswordErrorMessageGeneric')}
          </Text>
        )}
      </YStack>
    </OnboardingStep>
  )
}
