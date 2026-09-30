import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { Button, InputField, type InputFieldHandle, Text } from '@session/ui'
import { useRef, useState } from 'react'

import { displayNameAsStored, displayNameProblem, displayNameRemaining } from './displayName'
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
  /** What was typed last time, when this screen is being asked again. */
  initialName?: string
  /** The bridge refused to make or name the account. Nothing about the name itself is wrong. */
  rejected?: boolean
  busy?: boolean
}

/**
 * Naming the account.
 *
 * The error behaviour is `InputField`'s, shared with every other field that can be refused.
 *
 * **Too long is the exception: checked as it is typed, not on submit.** The legacy client validates
 * live, and the counter is why it is worth keeping -- it goes negative past the limit, which says
 * how far over but not what being over costs. The message is what gives the number meaning, so the
 * two arrive and leave together.
 */
export function PickDisplayNameScreen({
  afterFailedRestore,
  onBack,
  onContinue,
  initialName = '',
  rejected: refused = false,
  busy = false,
}: PickDisplayNameScreenProps) {
  const [name, setName] = useState(initialName)
  const field = useRef<InputFieldHandle>(null)

  const remaining = displayNameRemaining(name)
  const tooLong = remaining < 0

  return (
    <OnboardingStep
      title={afterFailedRestore ? tr('displayNameNew') : tr('displayNamePick')}
      description={afterFailedRestore ? tr('displayNameErrorNew') : tr('displayNameDescription')}
      onBack={onBack}
      // A back press while the account is being made, or discarded, starts a second one.
      backDisabled={busy}
      testID={ELEMENT.onboarding.displayNameScreen}
      footer={
        <Button
          // Outlined in the accent, like the landing screen's second button: the legacy clients
          // draw every onboarding Continue that way, stroke and label in the primary colour.
          variant="outlineAccent"
          testID={ELEMENT.onboarding.continueButton}
          loading={busy}
          // Nothing to submit, too long to submit, or the name was refused and nothing has
          // changed since. A refusal from the bridge is the exception: the name may be fine and
          // the account simply could not be made, so pressing again is the right thing to be able
          // to do.
          disabled={name.trim().length === 0 || tooLong}
          // Through the field, so the button refuses what the keyboard would refuse.
          onPress={() => field.current?.submit()}
        >
          {tr('theContinue')}
        </Button>
      }
    >
      <InputField
        ref={field}
        value={name}
        onChangeText={setName}
        // Checked live, as the client's own check leaves it: the message is what gives the counter
        // beside it its meaning, so the two arrive together.
        validate={(next) =>
          displayNameProblem(next) === 'tooLong' ? tr('displayNameErrorDescriptionShorter') : null
        }
        validateOn="change"
        // The bridge declining is not a complaint about the name: it may be perfectly good and the
        // account simply could not be made.
        error={refused ? tr('errorGeneric') : null}
        reserveErrorSpace
        errorTestID={ELEMENT.onboarding.displayNameError}
        placeholder={tr('displayNameEnter')}
        autoCapitalize="words"
        autoFocus
        onSubmit={() => {
          // Edges taken off and nothing else: see `displayNameAsStored`, and `displayName.ts` for
          // why the characters between them are left exactly as typed.
          onContinue(displayNameAsStored(name))
        }}
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
