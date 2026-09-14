import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { Button, Text, useMedia, YStack } from '@session/ui'
import { useEffect, useState } from 'react'

import { EXTRA_ACTION_INSET, OnboardingChrome } from './OnboardingChrome'
import { TermsAndPrivacy } from './TermsAndPrivacy'

/**
 * The four lines the mobile clients play out as a conversation, in order.
 *
 * **The emoji are not in the catalogue.** Android injects them from Kotlin -- `👋` on the welcome
 * and `👇` on the last line -- with a TODO about moving them into the strings one day. Pulling the
 * tokens alone yields the text without them, which reads as a missing translation rather than as a
 * deliberate omission, so they are supplied here for the same reason Android supplies them there.
 */
const BUBBLES = [
  { text: tr('onboardingBubbleWelcomeToSession', { emoji: '👋' }), outgoing: false },
  { text: tr('onboardingBubbleSessionIsEngineered'), outgoing: true },
  { text: tr('onboardingBubbleNoPhoneNumber'), outgoing: false },
  { text: tr('onboardingBubbleCreatingAnAccountIsEasy', { emoji: '👇' }), outgoing: true },
] as const

/**
 * The cadence both mobile clients use: a beat before the first line, then one every second and a
 * half. Android and iOS agree on these to within 300ms, which is close enough to be deliberate.
 */
const FIRST_BUBBLE_MS = 500
const BUBBLE_INTERVAL_MS = 1500

/**
 * How wide a bubble is allowed to get.
 *
 * iOS's number, from its bespoke `FakeChat`. A share of the width instead let a bubble run almost
 * edge to edge on a large phone, which stops reading as a conversation and starts reading as
 * paragraphs with rounded corners. Android draws these with the real message components and gets
 * the same effect from their own constraints.
 */
const BUBBLE_MAX_WIDTH = 230

interface LandingScreenProps {
  onCreate: () => void
  onRestore: () => void
}

/**
 * The first screen, and the only one that exists before an identity does.
 *
 * **The two designs share only the buttons and the terms.** The mobile clients open with a heading
 * and a fake conversation that plays itself out; the desktop client has neither -- artwork and the
 * Session lockup come from the frame around it, and the screen itself is two buttons. So "hero"
 * means text on a phone and artwork on a desktop, and this is a fork rather than a reflow.
 */
export function LandingScreen({ onCreate, onRestore }: LandingScreenProps) {
  const wide = useMedia().gtSm

  return (
    <OnboardingChrome testID={ELEMENT.onboarding.screen}>
      {wide ? null : <PhoneOpening />}
      {/* The buttons and the terms sit further in than the text above them on a phone, which is
          what both clients do -- see the insets. The wide design's column is already fixed. */}
      <YStack gap="$1.5" {...(wide ? {} : { paddingHorizontal: EXTRA_ACTION_INSET })}>
        {/* **The two designs weight these differently.** Both mobile clients fill the create
            button and outline the other, so the new account is the obvious one; the desktop client
            outlines both and leaves them level. Ported rather than unified -- a phone is somebody's
            first ten seconds with the app and a desktop install rarely is. */}
        <Button
          variant={wide ? 'outline' : 'solid'}
          testID={ELEMENT.onboarding.createAccount}
          onPress={onCreate}
        >
          {tr('onboardingAccountCreate')}
        </Button>
        {/* Outlined in the accent on a phone, which is what the legacy client does: stroke and
            label both in the primary colour, so the two buttons read as one accented pair with the
            new account filled. The desktop client outlines both in the text colour and leaves them
            level, which is the `wide` branch. */}
        <Button
          variant={wide ? 'outline' : 'outlineAccent'}
          testID={ELEMENT.onboarding.restoreAccount}
          onPress={onRestore}
        >
          {tr('onboardingAccountExists')}
        </Button>
        <TermsAndPrivacy />
      </YStack>
    </OnboardingChrome>
  )
}

/**
 * The heading and the conversation that plays itself out. Mobile only.
 *
 * The bubble region is the only part that flexes -- the heading takes the height it needs, which is
 * how Android's column is weighted -- and it holds that height from the start, so the buttons below
 * do not walk down the screen while the conversation arrives.
 */
function PhoneOpening() {
  const [shown, setShown] = useState(0)

  useEffect(() => {
    if (shown >= BUBBLES.length) return
    const timer = setTimeout(
      () => {
        setShown((count) => count + 1)
      },
      shown === 0 ? FIRST_BUBBLE_MS : BUBBLE_INTERVAL_MS,
    )
    return () => {
      clearTimeout(timer)
    }
  }, [shown])

  return (
    <YStack flex={1} gap="$3">
      <Text size="$displayLarge" weight="bold" textAlign="center">
        {tr('onboardingBubblePrivacyInYourPocket')}
      </Text>

      <YStack flex={1} justifyContent="center" gap="$1" minHeight={200}>
        {BUBBLES.slice(0, shown).map((bubble) => (
          <YStack
            key={bubble.text}
            maxWidth={BUBBLE_MAX_WIDTH}
            alignSelf={bubble.outgoing ? 'flex-end' : 'flex-start'}
            paddingVertical="$1.5"
            paddingHorizontal="$2"
            borderRadius="$3"
            backgroundColor={bubble.outgoing ? '$primaryColor' : '$messageBubbleIncomingBg'}
          >
            <Text size="$body" color={bubble.outgoing ? '$onAccent' : '$messageBubbleIncomingText'}>
              {bubble.text}
            </Text>
          </YStack>
        ))}
      </YStack>
    </YStack>
  )
}
