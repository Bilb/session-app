import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { Button, Input, Text } from '@session/ui'
import { useState } from 'react'

import { displayNameProblem, displayNameRemaining } from './displayName'
import { OnboardingStep } from './OnboardingStep'

/** How close to the limit before the count is worth showing. */
const COUNTER_THRESHOLD = 10

/** Room reserved inside the field for the count, so the text never runs under it. */
const COUNTER_WIDTH = 44

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
 * **The error rules are the designs', and the fourth one is the interesting one.** On a failed
 * submit the border, the text and the placeholder all turn red. Typing then returns the *text* to
 * its normal colour and clears the message — but **the border stays red** until the field is
 * submitted again. So the state is two flags, not one: whether the last submit failed, and whether
 * the value has been touched since.
 *
 * The message itself disappears on the first keystroke rather than persisting, which is a
 * deliberate departure from the written rules — a product call, on the grounds that a stale error
 * under a field somebody is actively correcting is confusing.
 */
export function PickDisplayNameScreen({
  afterFailedRestore,
  onBack,
  onContinue,
  busy = false,
}: PickDisplayNameScreenProps) {
  const [name, setName] = useState('')
  /** The last submit failed. Sticky: it is what keeps the border red while a correction is typed. */
  const [rejected, setRejected] = useState(false)
  /** Nothing has been typed since that failure, so the message and the red text still stand. */
  const [showing, setShowing] = useState(false)

  const remaining = displayNameRemaining(name)
  const tooLong = remaining < 0

  const submit = () => {
    const problem = displayNameProblem(name)
    if (problem === null) {
      onContinue(name)
      return
    }
    setRejected(true)
    setShowing(true)
  }

  return (
    <OnboardingStep
      title={afterFailedRestore ? tr('displayNameNew') : tr('displayNamePick')}
      description={afterFailedRestore ? tr('displayNameErrorNew') : tr('displayNameDescription')}
      onBack={onBack}
      testID={ELEMENT.onboarding.displayNameScreen}
      error={
        showing ? (
          <Text
            tone="danger"
            size="$label"
            weight="bold"
            testID={ELEMENT.onboarding.displayNameError}
          >
            {tooLong ? tr('displayNameErrorDescriptionShorter') : tr('displayNameErrorDescription')}
          </Text>
        ) : undefined
      }
      footer={
        <Button
          variant="outline"
          testID={ELEMENT.onboarding.continueButton}
          loading={busy}
          // Nothing to submit, or the last submit was refused and nothing has changed since.
          disabled={name.trim().length === 0 || showing}
          onPress={submit}
        >
          {tr('theContinue')}
        </Button>
      }
    >
      <Input
        value={name}
        onChangeText={(next) => {
          setName(next)
          // The message and the red text go; the border stays, because the field has not been
          // accepted yet and pretending otherwise invites the same refusal twice.
          setShowing(false)
        }}
        placeholder={tr('displayNameEnter')}
        autoCapitalize="words"
        autoFocus
        onSubmit={submit}
        error={rejected}
        errorText={showing}
        testID={ELEMENT.onboarding.displayNameInput}
        endWidth={remaining <= COUNTER_THRESHOLD ? COUNTER_WIDTH : 0}
        /* Inside the field, which is where the desktop client puts the message composer's count.
           A bare number: a count rather than copy, so it needs no string in the catalogue and
           reads the same in every language. It shows only near the limit and goes negative to say
           how far over. */
        end={
          remaining <= COUNTER_THRESHOLD ? (
            <Text
              tone={tooLong ? 'danger' : 'secondary'}
              size="$label"
              fontVariant={['tabular-nums']}
              userSelect="none"
              testID={ELEMENT.onboarding.displayNameCounter}
            >
              {remaining}
            </Text>
          ) : undefined
        }
      />
    </OnboardingStep>
  )
}
