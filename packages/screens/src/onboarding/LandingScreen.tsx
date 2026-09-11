import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { Button, Screen, Text, useMedia, XStack, YStack } from '@session/ui'
import { useEffect, useState } from 'react'

import { LanguageButton } from '../LanguageButton'
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

interface LandingScreenProps {
  onCreate: () => void
  onRestore: () => void
  /** Whether the language picker is offered here at all. */
  showLanguagePicker: boolean
}

/**
 * The first screen, and the only one that exists before an identity does.
 *
 * **The two designs share only the buttons and the terms.** The mobile clients open with a heading
 * and a fake conversation that plays itself out; the desktop client has neither -- its Start is a
 * hero image down one side and the two buttons beside it. So "hero" means text on a phone and
 * artwork on a desktop, and this is a fork rather than a reflow.
 *
 * The language picker is the one thing here no legacy client has -- they follow the OS and offer no
 * in-app override at all -- so there is no placement to match and this one is ours.
 */
export function LandingScreen({ onCreate, onRestore, showLanguagePicker }: LandingScreenProps) {
  const wide = useMedia().gtSm

  return (
    <Screen padded testID={ELEMENT.onboarding.screen}>
      <XStack justifyContent="flex-end" minHeight="$7">
        {showLanguagePicker ? <LanguageButton /> : null}
      </XStack>

      {wide ? (
        <DesktopStart onCreate={onCreate} onRestore={onRestore} />
      ) : (
        <PhoneLanding onCreate={onCreate} onRestore={onRestore} />
      )}
    </Screen>
  )
}

/**
 * The mobile opening: a heading, then a conversation that arrives a line at a time.
 *
 * The bubble region is the only part that flexes -- the heading and the buttons take the height
 * they need, which is how Android's column is weighted.
 */
function PhoneLanding({ onCreate, onRestore }: Omit<LandingScreenProps, 'showLanguagePicker'>) {
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

      {/* Holds its height from the start rather than growing line by line, so the buttons below do
          not walk down the screen while the conversation plays. */}
      <YStack flex={1} justifyContent="center" gap="$1" minHeight={200}>
        {BUBBLES.slice(0, shown).map((bubble) => (
          <YStack
            key={bubble.text}
            maxWidth="85%"
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

      <StartButtons onCreate={onCreate} onRestore={onRestore} />
    </YStack>
  )
}

/**
 * The desktop opening: artwork down one side, the two buttons beside it.
 *
 * **The hero artwork is not in this repo yet**, so the column it belongs in is held open and left
 * empty rather than filled with a stand-in. An empty 40% is obviously unfinished; a placeholder
 * graphic is something somebody has to notice is wrong.
 *
 * The 40% is the desktop client's, and it is a percentage rather than a breakpoint -- which is why
 * it scales to a tablet at all. It has no portrait rule anywhere, because no client has ever run
 * this design in portrait; a 40% column on a portrait tablet is a tall thin strip, and what it
 * should do instead is still an open question.
 */
function DesktopStart({ onCreate, onRestore }: Omit<LandingScreenProps, 'showLanguagePicker'>) {
  return (
    <XStack flex={1} gap="$3">
      <YStack width="40%" testID={ELEMENT.onboarding.hero} />
      <YStack flex={1} justifyContent="center" maxWidth={360} alignSelf="center">
        <StartButtons onCreate={onCreate} onRestore={onRestore} />
      </YStack>
    </XStack>
  )
}

/** The only part both designs share: what you can do, and what you are agreeing to. */
function StartButtons({ onCreate, onRestore }: Omit<LandingScreenProps, 'showLanguagePicker'>) {
  return (
    <YStack gap="$1.5">
      <Button testID={ELEMENT.onboarding.createAccount} onPress={onCreate}>
        {tr('onboardingAccountCreate')}
      </Button>
      <Button variant="outline" testID={ELEMENT.onboarding.restoreAccount} onPress={onRestore}>
        {tr('onboardingAccountExists')}
      </Button>
      <TermsAndPrivacy />
    </YStack>
  )
}
