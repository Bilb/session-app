import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { flag } from '@session/app'
import {
  Button,
  Icon,
  InputField,
  type InputFieldHandle,
  RecoveryPasswordMark,
  SlidePager,
  TopTabs,
  YStack,
} from '@session/ui'
import { useRef, useState } from 'react'

import { OnboardingChrome, useStepPadding } from './OnboardingChrome'
import { OnboardingStepBody } from './OnboardingStep'
import { ScanQrPane } from './ScanQrPane'
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
 * **Concealed by default, with a reveal toggle**, as the desktop client has it: a phrase is the
 * whole account in thirteen words and this screen is often reached with other people in the room,
 * but it is also the one field where a typo is invisible and fatal.
 *
 * Same error behaviour as the name field, which is `InputField`'s rather than either screen's.
 *
 * **The QR tab beside it is structure without a scanner.** Both clients offer two ways into a
 * restore, so the shape is here -- its own title in the bar, tabs across the width above the
 * column. The camera is not: the tab shows what the clients show before access is granted, and the
 * control that asks for it arrives with the port.
 */
export function LoadAccountScreen({
  onBack,
  onContinue,
  rejected = false,
  busy = false,
}: LoadAccountScreenProps) {
  const [tab, setTab] = useState<'phrase' | 'qr'>('phrase')
  const [phrase, setPhrase] = useState('')
  const [revealed, setRevealed] = useState(false)
  const field = useRef<InputFieldHandle>(null)

  const cut = flag('disableAnimations')
  // The chrome is not padding this step, so the pane does -- with the chrome's own figures.
  const stepPadding = useStepPadding()

  return (
    <OnboardingChrome
      testID={ELEMENT.onboarding.loadAccountScreen}
      onBack={onBack}
      barTitle={tr('loadAccount')}
      padContent={false}
      banner={
        <TopTabs
          active={tab}
          instant={cut}
          onChange={(next) => {
            setTab(next === 'qr' ? 'qr' : 'phrase')
          }}
          tabs={[
            {
              key: 'phrase',
              label: tr('sessionRecoveryPassword'),
              testID: ELEMENT.onboarding.recoveryPhraseTab,
            },
            { key: 'qr', label: tr('qrScan'), testID: ELEMENT.onboarding.scanQrTab },
          ]}
        />
      }
    >
      {/* One chrome and two panes rather than two screens: the bar, the title and the tabs stay
          put and only what is under them slides, which is what makes the indicator and the pane
          read as one movement. */}
      <SlidePager index={tab === 'qr' ? 1 : 0} instant={cut}>
        {/* The panes disagree about the inset, which is why the chrome is not applying one: the
            field belongs in the reading column and the camera fills the width. */}
        <YStack flex={1} {...stepPadding}>
          <OnboardingStepBody
            title={tr('sessionRecoveryPassword')}
            titleMark={<RecoveryPasswordMark size={22} color="$textPrimary" />}
            description={tr('recoveryPasswordRestoreDescription')}
            onBack={onBack}
            footer={
              <Button
                // Outlined in the accent, like the landing screen's second button: the legacy
                // clients draw every onboarding Continue that way, stroke and label in the primary
                // colour.
                variant="outlineAccent"
                testID={ELEMENT.onboarding.continueButton}
                loading={busy}
                disabled={phrase.trim().length === 0}
                // Through the field, so the button refuses what the keyboard would refuse.
                onPress={() => field.current?.submit()}
              >
                {tr('theContinue')}
              </Button>
            }
          >
            <InputField
              ref={field}
              value={phrase}
              onChangeText={setPhrase}
              // The button is inert while the check runs; the keyboard's own submit is a second
              // way in, and pressing it twice sends the same phrase twice -- the first `finally`
              // then clears `busy` while the second is still running.
              disabled={busy}
              // Checked on submit rather than as it is typed: a phrase is too short for as long as
              // it is half-entered, and saying so on every word is noise.
              validate={(next) =>
                phraseIsTooShort(next) ? tr('recoveryPasswordErrorMessageShort') : null
              }
              // Generic rather than "incorrect": the bridge flattens libsession's several refusals
              // into one message, so this cannot tell which it was.
              error={rejected ? tr('recoveryPasswordErrorMessageGeneric') : null}
              onSubmit={() => {
                onContinue({ words: phraseWords(phrase) })
              }}
              reserveErrorSpace
              errorTestID={ELEMENT.onboarding.recoveryPhraseError}
              placeholder={tr('recoveryPasswordEnter')}
              autoCapitalize="none"
              // The phrase is words from a list, so a keyboard treats it as prose and learns it.
              // See `private`.
              private
              autoFocus
              // Concealed until asked for. The toggle is the only way to read it back, which is the
              // point -- a phrase typed blind cannot be checked over.
              secureTextEntry={!revealed}
              testID={ELEMENT.onboarding.recoveryPhraseInput}
              endWidth={TOGGLE_WIDTH}
              // A function, because the toggle turns red with the text around it and whether a
              // message is showing is the field's to know.
              end={(showing) => (
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
                      size="lg"
                      color={showing ? '$dangerColor' : '$textSecondary'}
                    />
                  }
                />
              )}
            />
          </OnboardingStepBody>
        </YStack>
        <ScanQrPane
          showing={tab === 'qr'}
          onScan={(value) => {
            // Handed over as it was read. Whether it decodes to a seed is libsession's to say, and
            // its refusal comes back the same way a typed phrase's does.
            onContinue({ hexSeed: value })
          }}
          error={rejected ? tr('qrNotRecoveryPassword') : null}
        />
      </SlidePager>
    </OnboardingChrome>
  )
}
