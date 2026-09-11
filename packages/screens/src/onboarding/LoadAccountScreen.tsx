import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { Button, Icon, Input, RecoveryPasswordMark, Text, YStack } from '@session/ui'
import { useState } from 'react'

import { OnboardingStep } from './OnboardingStep'
import { phraseIsTooShort, phraseWords } from './recoveryPhrase'
import type { RecoveryInput } from './flow'

/** Room reserved inside the field for the reveal toggle. */
const TOGGLE_WIDTH = 40

/** Held whether or not there is an error, so the button below does not move. */
const ERROR_HEIGHT = 18

interface LoadAccountScreenProps {
  onBack: () => void
  onContinue: (from: RecoveryInput) => void
  /** Whether the bridge refused the last phrase. */
  rejected?: boolean
  busy?: boolean
}

/**
 * Entering a recovery phrase.
 *
 * **Concealed by default, with a reveal toggle**, as the desktop client has it. A recovery phrase is
 * the whole account in thirteen words, and this screen is often reached in a room with other people
 * in it -- but it is also the one field where a typo is invisible and fatal, so it has to be
 * readable on demand rather than only on trust.
 *
 * **The QR tab the legacy clients offer beside this is not here yet.** Scanning needs a camera and
 * this app has no camera port; a tab that opened onto nothing would be worse than its absence.
 */
export function LoadAccountScreen({
  onBack,
  onContinue,
  rejected = false,
  busy = false,
}: LoadAccountScreenProps) {
  const [phrase, setPhrase] = useState('')
  const [tooShort, setTooShort] = useState(false)
  const [revealed, setRevealed] = useState(false)

  const submit = () => {
    const short = phraseIsTooShort(phrase)
    setTooShort(short)
    if (!short) onContinue({ words: phraseWords(phrase) })
  }

  return (
    <OnboardingStep
      title={tr('sessionRecoveryPassword')}
      titleMark={<RecoveryPasswordMark size={22} color="var(--textPrimary)" />}
      description={tr('recoveryPasswordRestoreDescription')}
      onBack={onBack}
      testID={ELEMENT.onboarding.loadAccountScreen}
      footer={
        <Button
          variant="outline"
          testID={ELEMENT.onboarding.continueButton}
          loading={busy}
          onPress={submit}
        >
          {tr('theContinue')}
        </Button>
      }
    >
      <YStack>
        <Input
          value={phrase}
          onChangeText={(next) => {
            setPhrase(next)
            setTooShort(false)
          }}
          placeholder={tr('recoveryPasswordEnter')}
          autoCapitalize="none"
          autoFocus
          secureTextEntry={!revealed}
          testID={ELEMENT.onboarding.recoveryPhraseInput}
          endWidth={TOGGLE_WIDTH}
          end={
            <Button
              variant="ghost"
              size="xs"
              circular
              accessibilityLabel={revealed ? tr('hide') : tr('show')}
              testID={ELEMENT.onboarding.recoveryPhraseReveal}
              onPress={() => {
                setRevealed((shown) => !shown)
              }}
              icon={<Icon name={revealed ? 'eyeOff' : 'eye'} size="$5" color="$textSecondary" />}
            />
          }
        />

        <YStack height={ERROR_HEIGHT} justifyContent="center">
          {tooShort || rejected ? (
            <Text tone="danger" size="$label" testID={ELEMENT.onboarding.recoveryPhraseError}>
              {tooShort
                ? tr('recoveryPasswordErrorMessageShort')
                : // Generic rather than "incorrect", because the bridge flattens libsession's
                  // several refusals into one message and this cannot tell which it was.
                  tr('recoveryPasswordErrorMessageGeneric')}
            </Text>
          ) : null}
        </YStack>
      </YStack>
    </OnboardingStep>
  )
}
