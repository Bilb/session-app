import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { Button, Input, Text, YStack } from '@session/ui'
import { useState } from 'react'

import { displayNameProblem, displayNameRemaining } from './displayName'
import { OnboardingStep } from './OnboardingStep'

/** How close to the limit before the count is worth showing. */
const COUNTER_THRESHOLD = 10

/** Room reserved inside the field for the count, so the text never runs under it. */
const COUNTER_WIDTH = 44

/**
 * Space held for the error, whether or not there is one.
 *
 * An error that appears between a field and a button pushes the button down as you type, so the
 * control moves out from under the cursor at exactly the moment it is about to be pressed.
 */
const ERROR_HEIGHT = 18

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
 * underneath, and the confirm control disabled while the error stands.
 *
 * Blank is checked on submit and length is checked as you type. The difference is that one of them
 * you can see coming: a counter that runs down is useful, where "please enter a display name" under
 * an empty field you have not finished filling in is just telling you off.
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
          variant="outline"
          testID={ELEMENT.onboarding.continueButton}
          loading={busy}
          disabled={tooLong}
          onPress={submit}
        >
          {tr('theContinue')}
        </Button>
      }
    >
      <YStack>
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
          endWidth={remaining <= COUNTER_THRESHOLD ? COUNTER_WIDTH : 0}
          /* Inside the field, which is where the desktop client puts the message composer's count
             too. A counter underneath is one more thing that appears and shifts what is below it.

             A bare number, deliberately: a count rather than copy, so it needs no string in the
             catalogue and reads the same in every language. It shows only near the limit, and goes
             negative to say how far over -- which is the thing worth knowing once it is. */
          end={
            remaining <= COUNTER_THRESHOLD ? (
              <Text
                tone={tooLong ? 'danger' : 'secondary'}
                size="$label"
                fontVariant={['tabular-nums']}
                testID={ELEMENT.onboarding.displayNameCounter}
              >
                {remaining}
              </Text>
            ) : undefined
          }
        />

        {/* Always present, so nothing below it moves when the message arrives. */}
        <YStack height={ERROR_HEIGHT} justifyContent="center">
          {submittedEmpty || tooLong ? (
            <Text tone="danger" size="$label" testID={ELEMENT.onboarding.displayNameError}>
              {tooLong
                ? tr('displayNameErrorDescriptionShorter')
                : tr('displayNameErrorDescription')}
            </Text>
          ) : null}
        </YStack>
      </YStack>
    </OnboardingStep>
  )
}
