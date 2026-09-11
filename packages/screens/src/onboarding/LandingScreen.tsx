import { requirePorts } from '@session/app'
import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { Button, Screen, Text, useMedia, XStack, YStack } from '@session/ui'
import { useEffect, useState } from 'react'

import { LanguageButton } from '../LanguageButton'
import { LocalizedText } from '../LocalizedText'

/**
 * The four lines that arrive as a conversation, in the order the legacy clients send them.
 *
 * They are written as messages rather than as a feature list -- "Welcome to Session", then an
 * answer, then another -- so they are drawn as messages. Two of them carry an `{emoji}` argument,
 * which is the other tell: the catalogue expects them in bubbles.
 *
 * Alternating sides, starting incoming, because a one-sided run of four reads as one long message
 * and the copy is written as an exchange.
 */
const BUBBLES = [
  { text: tr('onboardingBubbleWelcomeToSession', { emoji: '👋' }), outgoing: false },
  { text: tr('onboardingBubbleSessionIsEngineered'), outgoing: true },
  { text: tr('onboardingBubbleNoPhoneNumber'), outgoing: false },
  { text: tr('onboardingBubbleCreatingAnAccountIsEasy', { emoji: '🚀' }), outgoing: true },
] as const

/** How long between one bubble arriving and the next. */
const BUBBLE_INTERVAL_MS = 900

interface LandingScreenProps {
  onCreate: () => void
  onRestore: () => void
  /** Whether the language picker is offered here at all. */
  showLanguagePicker: boolean
}

/**
 * The first screen, and the only one that exists before an identity does.
 *
 * A headline, four lines of conversation, the two things you can do, and the terms. The bubbles
 * arrive one at a time: the copy is written as an exchange, and an exchange that is all present at
 * once is a list.
 *
 * The language picker is the one thing here the legacy clients do not have -- they follow the OS
 * and offer no in-app override at all -- so there is no placement to match and this one is ours.
 */
export function LandingScreen({ onCreate, onRestore, showLanguagePicker }: LandingScreenProps) {
  const wide = useMedia().gtSm
  const [shown, setShown] = useState(1)

  useEffect(() => {
    if (shown >= BUBBLES.length) return
    const timer = setTimeout(() => {
      setShown((count) => count + 1)
    }, BUBBLE_INTERVAL_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [shown])

  const openTerms = (url: string) => {
    // The legacy clients confirm before leaving for a browser rather than leaving straight away.
    // Kept because this screen is the one place somebody has not yet chosen to trust the app.
    void requirePorts().linking.openUrl(url)
  }

  return (
    <Screen padded testID={ELEMENT.onboarding.screen}>
      <XStack justifyContent="flex-end" minHeight="$7">
        {showLanguagePicker ? <LanguageButton /> : null}
      </XStack>

      <YStack
        flex={1}
        gap="$3"
        {...(wide
          ? { alignSelf: 'center', width: '100%', maxWidth: 460, justifyContent: 'center' }
          : {})}
      >
        <Text size="$displayLarge" weight="bold">
          {tr('onboardingBubblePrivacyInYourPocket')}
        </Text>

        <YStack gap="$1" flex={wide ? undefined : 1}>
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
              <Text
                size="$body"
                color={bubble.outgoing ? '$onAccent' : '$messageBubbleIncomingText'}
              >
                {bubble.text}
              </Text>
            </YStack>
          ))}
        </YStack>

        <YStack gap="$1.5">
          <Button testID={ELEMENT.onboarding.createAccount} onPress={onCreate}>
            {tr('onboardingAccountCreate')}
          </Button>
          <Button variant="outline" testID={ELEMENT.onboarding.restoreAccount} onPress={onRestore}>
            {tr('onboardingAccountExists')}
          </Button>

          {/* The only place in the app the terms appear, which is why they are here rather than in
              settings: this is the screen where agreeing to them happens. */}
          <LocalizedText
            text={tr('onboardingTosPrivacy')}
            tone="secondary"
            size="$caption"
            textAlign="center"
            testID={ELEMENT.onboarding.termsOfService}
            onPress={() => {
              openTerms('https://getsession.org/terms-of-service')
            }}
          />
        </YStack>
      </YStack>
    </Screen>
  )
}
