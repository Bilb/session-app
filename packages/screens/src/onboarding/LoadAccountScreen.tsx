import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { Button, Icon, Input, RecoveryPasswordMark, Text } from '@session/ui'
import { useState } from 'react'

import { OnboardingStep } from './OnboardingStep'
import { phraseIsTooShort, phraseWords } from './recoveryPhrase'
import type { RecoveryInput } from './flow'

/** Room reserved inside the field for the reveal toggle. The desktop client reserves 48. */
const TOGGLE_WIDTH = 48

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
 * **Concealed by default, with a reveal toggle**, as the desktop client has it. A recovery phrase
 * is the whole account in thirteen words and this screen is often reached in a room with other
 * people in it -- but it is also the one field where a typo is invisible and fatal, so it has to be
 * readable on demand rather than only on trust.
 *
 * Same error rules as the name screen: border, text and the toggle icon all turn red on a refusal,
 * typing clears the message and the red text, the border stays until it is submitted again.
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
  const [revealed, setRevealed] = useState(false)
  /** The last submit was refused, here or by the bridge. Keeps the border red through a correction. */
  const [refused, setRefused] = useState(false)
  /** Nothing typed since that refusal. */
  const [showing, setShowing] = useState(false)
  const [tooShort, setTooShort] = useState(false)

  // A refusal from the bridge arrives as a prop rather than from `submit`, so it has to fold into
  // the same two flags the local check sets.
  const failed = refused || rejected
  const visible = showing || rejected

  const submit = () => {
    const short = phraseIsTooShort(phrase)
    setTooShort(short)
    setRefused(true)
    setShowing(true)
    if (!short) onContinue({ words: phraseWords(phrase) })
  }

  return (
    <OnboardingStep
      title={tr('sessionRecoveryPassword')}
      titleMark={<RecoveryPasswordMark size={22} color="var(--textPrimary)" />}
      description={tr('recoveryPasswordRestoreDescription')}
      onBack={onBack}
      testID={ELEMENT.onboarding.loadAccountScreen}
      error={
        visible ? (
          <Text
            tone="danger"
            size="$label"
            weight="bold"
            testID={ELEMENT.onboarding.recoveryPhraseError}
          >
            {tooShort
              ? tr('recoveryPasswordErrorMessageShort')
              : // Generic rather than "incorrect", because the bridge flattens libsession's
                // several refusals into one message and this cannot tell which it was.
                tr('recoveryPasswordErrorMessageGeneric')}
          </Text>
        ) : undefined
      }
      footer={
        <Button
          variant="outline"
          testID={ELEMENT.onboarding.continueButton}
          loading={busy}
          disabled={phrase.trim().length === 0 || visible}
          onPress={submit}
        >
          {tr('theContinue')}
        </Button>
      }
    >
      <Input
        value={phrase}
        onChangeText={(next) => {
          setPhrase(next)
          setShowing(false)
          setTooShort(false)
        }}
        placeholder={tr('recoveryPasswordEnter')}
        autoCapitalize="none"
        autoFocus
        // Concealed until asked for. The toggle is the only way to read it back, which is the
        // point -- a phrase typed blind cannot be checked over.
        secureTextEntry={!revealed}
        error={failed}
        errorText={visible}
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
            icon={
              <Icon
                name={revealed ? 'eyeOff' : 'eye'}
                size="$5"
                color={visible ? '$dangerColor' : '$textSecondary'}
              />
            }
          />
        }
      />
    </OnboardingStep>
  )
}
