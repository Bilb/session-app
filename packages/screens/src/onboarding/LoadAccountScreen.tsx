import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { flag } from '@session/app'
import {
  Button,
  Icon,
  Input,
  RecoveryPasswordMark,
  SlidePager,
  Text,
  TopTabs,
  YStack,
} from '@session/ui'
import { useEffect, useState } from 'react'

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
 * Same error rules as the name screen: border, text and the toggle icon turn red on a refusal,
 * typing clears the message and the red text, the border stays until it is submitted again.
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
  /** The last submit was refused, here or by the bridge. Keeps the border red through a correction. */
  const [refused, setRefused] = useState(false)
  /** Nothing typed since that refusal. */
  const [showing, setShowing] = useState(false)
  const [tooShort, setTooShort] = useState(false)

  /**
   * A refusal from the bridge is latched into the same two flags the local check sets, rather
   * than read straight from the prop.
   *
   * Read directly it was a dead end: the prop only goes false when the *next* submit starts, so
   * the error stayed up and the continue button stayed disabled no matter what was typed -- and
   * the field cannot be submitted again to clear it. Against the fake this was invisible, because
   * the fake accepts every phrase; it takes a wrong phrase and real libsession to reach at all.
   */
  useEffect(() => {
    if (!rejected) return
    setRefused(true)
    setShowing(true)
    setTooShort(false)
  }, [rejected])

  const submit = () => {
    const short = phraseIsTooShort(phrase)
    if (!short) {
      // No error state on the way out. Setting the flags before handing the phrase over painted
      // the field red for the frames between the press and the step changing, so a phrase that was
      // accepted flashed as refused first. The bridge's own refusal arrives as `rejected`.
      onContinue({ words: phraseWords(phrase) })
      return
    }
    setTooShort(true)
    setRefused(true)
    setShowing(true)
  }

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
            error={
              showing ? (
                <Text
                  tone="danger"
                  size="$label"
                  weight="bold"
                  // Centred under the field, as both clients set it. The field is the full width of the
                  // column and the message is usually much shorter, so left-aligned it reads as a label
                  // for the field rather than as a complaint about what is in it.
                  textAlign="center"
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
                // Outlined in the accent, like the landing screen's second button: the legacy
                // clients draw every onboarding Continue that way, stroke and label in the primary
                // colour.
                variant="outlineAccent"
                testID={ELEMENT.onboarding.continueButton}
                loading={busy}
                disabled={phrase.trim().length === 0 || showing}
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
              error={refused}
              errorText={showing}
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
                      color={showing ? '$dangerColor' : '$textSecondary'}
                    />
                  }
                />
              }
            />
          </OnboardingStepBody>
        </YStack>
        <ScanQrPane
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
