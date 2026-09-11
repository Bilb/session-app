import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { Button, Input, Text, XStack, YStack } from '@session/ui'
import { useState } from 'react'

import { displayNameProblem, displayNameRemaining } from './displayName'
import { OnboardingStep } from './OnboardingStep'

/** How close to the limit before the count is worth showing. */
const COUNTER_THRESHOLD = 10

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
 * **The field accepts whatever is typed and says what is wrong**, rather than refusing keystrokes.
 * That is what the desktop client does where it validates a name at all: free input, an error
 * underneath, and the confirm control disabled while the error stands. The one place it caps input
 * instead is group creation, and that cap is in the wrong unit -- an HTML `maxLength` counting
 * UTF-16 against a limit written in bytes -- which is a fair illustration of why refusing input is
 * the harder thing to get right.
 *
 * Blank is checked on submit and length is checked as you type. The difference is that one of them
 * you can see coming: a counter that runs down is useful, where "please enter a display name"
 * under an empty field you have not finished filling in is just telling you off.
 */
export function PickDisplayNameScreen({
  afterFailedRestore,
  onBack,
  onContinue,
  busy = false,
}: PickDisplayNameScreenProps) {
  const [name, setName] = useState('')
  const [submittedEmpty, setSubmittedEmpty] = useState(false)

  const remaining = displayNameRemaining(name)
  const tooLong = remaining < 0

  const submit = () => {
    const problem = displayNameProblem(name)
    setSubmittedEmpty(problem === 'empty')
    if (problem === null) onContinue(name)
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
          // Disabled only for the failure that is already explained on screen. An empty field
          // leaves it enabled, because a button that does nothing and says nothing is worse than
          // one that answers when pressed.
          disabled={tooLong}
          onPress={submit}
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
            setSubmittedEmpty(false)
          }}
          placeholder={tr('displayNameEnter')}
          autoCapitalize="words"
          autoFocus
          onSubmit={submit}
          testID={ELEMENT.onboarding.displayNameInput}
        />

        <XStack gap="$1" alignItems="flex-start">
          <YStack flex={1}>
            {submittedEmpty ? (
              <Text tone="danger" size="$label" testID={ELEMENT.onboarding.displayNameError}>
                {tr('displayNameErrorDescription')}
              </Text>
            ) : null}
            {tooLong ? (
              <Text tone="danger" size="$label" testID={ELEMENT.onboarding.displayNameError}>
                {tr('displayNameErrorDescriptionShorter')}
              </Text>
            ) : null}
          </YStack>

          {/* A bare number, and deliberately so: it is a count rather than copy, so it needs no
              string in the catalogue and reads the same in every language. It appears only near
              the limit -- a counter sitting at 35 from the first keystroke is noise -- and goes
              negative to say how far over, which is the thing worth knowing once it is.

              The number counts down in whichever unit runs out first, so a CJK name stops at 33
              rather than 35. See displayNameRemaining: 100 bytes is libSession's limit and binds
              before the character cap for any three-byte script. */}
          {remaining <= COUNTER_THRESHOLD ? (
            <Text
              tone={tooLong ? 'danger' : 'secondary'}
              size="$label"
              // Digits line up as the count changes, so the number does not jitter sideways.
              fontVariant={['tabular-nums']}
              testID={ELEMENT.onboarding.displayNameCounter}
            >
              {remaining}
            </Text>
          ) : null}
        </XStack>
      </YStack>
    </OnboardingStep>
  )
}
