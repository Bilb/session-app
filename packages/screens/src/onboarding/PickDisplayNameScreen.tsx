import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { Button, Input, Text } from '@session/ui'
import { useEffect, useState } from 'react'

import { useRejection } from './useRejection'

import { displayNameProblem, displayNameRemaining } from './displayName'
import { OnboardingStep } from './OnboardingStep'

/** How close to the limit before the count is worth rejection.showing. */
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
 * The error behaviour is `useRejection`'s, shared with the phrase field.
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
  const rejection = useRejection(refused)
  /** The refusal came from the bridge rather than from the name, which is a different message. */
  const [failedToCommit, setFailedToCommit] = useState(refused)

  useEffect(() => {
    if (refused) setFailedToCommit(true)
  }, [refused])

  const remaining = displayNameRemaining(name)
  const tooLong = remaining < 0

  const submit = () => {
    const problem = displayNameProblem(name)
    if (problem === null) {
      // What was typed, unchanged. See displayName.ts for why this is not normalised.
      onContinue(name)
      return
    }
    rejection.reject()
    setFailedToCommit(false)
  }

  return (
    <OnboardingStep
      title={afterFailedRestore ? tr('displayNameNew') : tr('displayNamePick')}
      description={afterFailedRestore ? tr('displayNameErrorNew') : tr('displayNameDescription')}
      onBack={onBack}
      testID={ELEMENT.onboarding.displayNameScreen}
      error={
        rejection.showing || tooLong ? (
          <Text
            tone="danger"
            size="$label"
            weight="bold"
            // Centred under the field, as both clients set it. The field is the full width of the
            // column and the message is usually much shorter, so left-aligned it reads as a label
            // for the field rather than as a complaint about what is in it.
            textAlign="center"
            testID={ELEMENT.onboarding.displayNameError}
          >
            {/* Too long wins over a refusal from the bridge, because it is the live one: the
                refusal describes an attempt that is over, and this describes what is on screen.
                And a refusal is not a complaint about the name either way -- the name may be
                perfectly good and the account simply could not be made. */}
            {tooLong
              ? tr('displayNameErrorDescriptionShorter')
              : failedToCommit
                ? tr('errorGeneric')
                : tr('displayNameErrorDescription')}
          </Text>
        ) : undefined
      }
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
          disabled={name.trim().length === 0 || tooLong || (rejection.showing && !failedToCommit)}
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
          rejection.typed()
        }}
        placeholder={tr('displayNameEnter')}
        autoCapitalize="words"
        autoFocus
        onSubmit={submit}
        // Red live while it is over the limit, as the client's own live check leaves it: the
        // border and the text are the field agreeing with the counter beside them.
        error={rejection.sticky || tooLong}
        errorText={rejection.showing || tooLong}
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
