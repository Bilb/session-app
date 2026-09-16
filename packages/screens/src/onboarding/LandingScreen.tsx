import { flag } from '@session/app'
import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { Button, Reveal, Text, useMedia, YStack } from '@session/ui'
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
 * How wide a bubble is allowed to get: **a share of the box, not a number of points.**
 *
 * This was iOS's flat 230, from its bespoke `FakeChat`, because an earlier *uncapped* share let a
 * bubble run almost edge to edge on a large phone -- which stops reading as a conversation and
 * starts reading as paragraphs with rounded corners. Android has the better answer, and it is a
 * share with both ends closed: `min(500, max(200, available x 0.8))`.
 *
 * Worked against our own insets, neither end of Android's ever fires -- the floor wants a screen
 * under 320pt and the cap a column over 625 -- so what is left of the formula is the 80%. It lands
 * at 62-67% of the screen on every phone from an SE to a 16 Pro Max, against the flat number's 52%
 * to 72%, and at 278 of the 348-point column on the wide designs.
 *
 * A percentage rather than a measured width for the reason the hero panel is one: a number
 * computed in JS from the window lags the box it is meant to describe while that box is animating.
 */
const BUBBLE_MAX_WIDTH = '80%'

/**
 * The height the conversation is played out in, and why the earlier lines move.
 *
 * The legacy client bottom-aligns the stack inside a box of this fixed height, so each bubble that
 * arrives pushes the ones above it upward. Ours grew downward from a centred stack instead, which
 * is why the conversation read as a list filling in rather than as messages arriving -- the
 * movement is most of the effect, and it belongs to the container rather than to the bubble.
 */
const CONVERSATION_HEIGHT = 320

/** The gap between bubbles, and the bubble's own metrics. The client's numbers. */
const BUBBLE_GAP = 18
const BUBBLE_PADDING = 12
const BUBBLE_RADIUS = 13

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
        // No layout animation here: the arriving bubble grows into its own space, which moves the
        // ones above it exactly as far, in the same frame. Asking a layout animation to slide them
        // as well put two animations in charge of one distance and they overlapped.
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
      {/* 26 bold, which both clients use for every onboarding heading -- iOS's `veryLargeFontSize`
          and Android's `h4`. Ours was 36, which wrapped a line the clients fit on one. */}
      <Text size="$headingLarge" weight="bold" textAlign="center">
        {tr('onboardingBubblePrivacyInYourPocket')}
      </Text>

      <YStack height={CONVERSATION_HEIGHT} justifyContent="flex-end" gap={BUBBLE_GAP}>
        {BUBBLES.slice(0, shown).map((bubble) => (
          <Reveal key={bubble.text} instant={flag('disableAnimations')}>
            <YStack
              maxWidth={BUBBLE_MAX_WIDTH}
              alignSelf={bubble.outgoing ? 'flex-end' : 'flex-start'}
              padding={BUBBLE_PADDING}
              borderRadius={BUBBLE_RADIUS}
              backgroundColor={bubble.outgoing ? '$primaryColor' : '$messageBubbleIncomingBg'}
            >
              {/* 16, which is the one size both clients agree on for this: iOS hardcodes
                  `.system(size: 16)` in its bespoke bubble and Android's landing reuses the real
                  conversation bubble, whose body is 16. Ours was 14. */}
              <Text
                size="$bodyLarge"
                color={bubble.outgoing ? '$onAccent' : '$messageBubbleIncomingText'}
              >
                {bubble.text}
              </Text>
            </YStack>
          </Reveal>
        ))}
      </YStack>
    </YStack>
  )
}
