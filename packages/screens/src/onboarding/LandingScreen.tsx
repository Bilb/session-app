import { flag } from '@session/app'
import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { Button, Reveal, Text, useMedia, YStack } from '@session/ui'
import { useEffect, useState } from 'react'

import { BUBBLE_MIN_WIDTH, bubbleMaxWidth } from './landingBubble'
import { EXTRA_ACTION_INSET, OnboardingChrome } from './OnboardingChrome'
import { TermsAndPrivacy } from './TermsAndPrivacy'

/**
 * The four lines the mobile clients play out as a conversation, in order.
 *
 * **The emoji are not in the catalogue.** Android injects them from Kotlin -- `👋` on the welcome
 * and `👇` on the last line -- with a TODO about moving them into the strings one day. Pulling the
 * tokens alone yields the text without them, which reads as a missing translation rather than as a
 * deliberate omission, so they are supplied here for the same reason Android supplies them there.
 *
 * **A function, not a constant**, because `tr()` reads the locale at the moment it is called. Built
 * once at module scope these four hold whichever language was current when the module was first
 * imported, for the life of the process -- so the heading and the buttons follow the picker and the
 * conversation does not. Anything built from `tr()` has to be built during a render.
 */
function bubbles() {
  return [
    { text: tr('onboardingBubbleWelcomeToSession', { emoji: '👋' }), outgoing: false },
    { text: tr('onboardingBubbleSessionIsEngineered'), outgoing: true },
    { text: tr('onboardingBubbleNoPhoneNumber'), outgoing: false },
    { text: tr('onboardingBubbleCreatingAnAccountIsEasy', { emoji: '👇' }), outgoing: true },
  ] as const
}

/** How many lines the conversation has. Fixed, and needed before the strings are built. */
const BUBBLE_COUNT = 4

/**
 * The cadence both mobile clients use: a beat before the first line, then one every second and a
 * half. Android and iOS agree on these to within 300ms, which is close enough to be deliberate.
 */
const FIRST_BUBBLE_MS = 500
const BUBBLE_INTERVAL_MS = 1500

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
    // No field on this screen, so nothing here should move for a keyboard -- see the prop.
    <OnboardingChrome testID={ELEMENT.onboarding.screen} avoidsKeyboard={false}>
      {wide ? null : <PhoneOpening />}
      {/* The buttons and the terms sit further in than the text above them on a phone, which is
          what both clients do -- see the insets. The wide design's column is already fixed. */}
      <YStack gap="$sm" {...(wide ? {} : { paddingHorizontal: EXTRA_ACTION_INSET })}>
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
  /** The conversation's own width, which is what a bubble's share is a share of. */
  const [chatWidth, setChatWidth] = useState(0)

  useEffect(() => {
    if (shown >= BUBBLE_COUNT) return
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
    <YStack flex={1} gap="$xl">
      {/* 26 bold, which both clients use for every onboarding heading -- iOS's `veryLargeFontSize`
          and Android's `h4`. Ours was 36, which wrapped a line the clients fit on one. */}
      <Text size="$headingLarge" weight="bold" textAlign="center">
        {tr('onboardingBubblePrivacyInYourPocket')}
      </Text>

      <YStack
        height={CONVERSATION_HEIGHT}
        justifyContent="flex-end"
        gap={BUBBLE_GAP}
        onLayout={(event) => {
          setChatWidth(event.nativeEvent.layout.width)
        }}
      >
        {bubbles()
          .slice(0, shown)
          .map((bubble) => (
            <Reveal key={bubble.text} instant={flag('disableAnimations')}>
              <YStack
                // The floor until the container has been measured, which is one frame and is over
                // long before the first bubble is due.
                maxWidth={chatWidth === 0 ? BUBBLE_MIN_WIDTH : bubbleMaxWidth(chatWidth)}
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
