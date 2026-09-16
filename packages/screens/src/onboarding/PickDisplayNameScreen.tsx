import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { Button, Input, Text } from '@session/ui'
import { useEffect, useState } from 'react'

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
  /** What was typed last time, when this screen is being asked again. */
  initialName?: string
  /** The bridge refused to make or name the account. Nothing about the name itself is wrong. */
  rejected?: boolean
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
 *
 * **Too long is the exception: it is checked as it is typed, not on submit.** The legacy client
 * validates this field live, and the reason to keep that is the counter -- it appears ten from the
 * limit and goes negative past it, which says how far over but not what being over costs. The
 * message is what gives the number its meaning, so it arrives at the same moment and leaves again
 * as soon as the name is short enough. A product call.
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
  /** The last submit failed. Sticky: it is what keeps the border red while a correction is typed. */
  const [rejected, setRejected] = useState(false)
  /** Nothing has been typed since that failure, so the message and the red text still stand. */
  const [showing, setShowing] = useState(false)
  /** The refusal came from the bridge rather than from the name, which is a different message. */
  const [failedToCommit, setFailedToCommit] = useState(false)

  // Latched rather than read from the prop: the prop describes an attempt that is over, and the
  // message has to clear on the next keystroke like every other error on this screen does.
  useEffect(() => {
    if (!refused) return
    setRejected(true)
    setShowing(true)
    setFailedToCommit(true)
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
    setRejected(true)
    setShowing(true)
    setFailedToCommit(false)
  }

  return (
    <OnboardingStep
      title={afterFailedRestore ? tr('displayNameNew') : tr('displayNamePick')}
      description={afterFailedRestore ? tr('displayNameErrorNew') : tr('displayNameDescription')}
      onBack={onBack}
      testID={ELEMENT.onboarding.displayNameScreen}
      error={
        showing || tooLong ? (
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
          disabled={name.trim().length === 0 || tooLong || (showing && !failedToCommit)}
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
        // Red live while it is over the limit, as the client's own live check leaves it: the
        // border and the text are the field agreeing with the counter beside them.
        error={rejected || tooLong}
        errorText={showing || tooLong}
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
