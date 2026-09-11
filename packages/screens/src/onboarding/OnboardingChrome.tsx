import { requirePorts, flag } from '@session/app'
import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import {
  Button,
  HeroImage,
  Icon,
  Screen,
  SessionBrand,
  SessionWordmark,
  useMedia,
  XStack,
  YStack,
} from '@session/ui'
import type { ReactNode } from 'react'

import { LanguageButton } from '../LanguageButton'

/** The desktop client's registration column. Everything inside onboarding is this wide. */
const COLUMN_WIDTH = 348
/** The hero's share of the window. A maximum, not a fixed split. */
const HERO_FRACTION = '40%'

/**
 * Where the two documentation links go.
 *
 * Hardcoded for the same reason the terms are: this is reachable before anybody has decided to
 * trust the app, and a URL a translation could change is a phishing surface.
 */
const FAQ_URL = 'https://getsession.org/faq'
const WEBSITE_URL = 'https://getsession.org'

/**
 * The frame every onboarding screen sits in, and the thing that differs most between the designs.
 *
 * **Desktop**: artwork down the left, and to the right of it a fixed-width column carrying the
 * Session lockup, the help links, and then the step. The lockup and the links are above *every*
 * step rather than only the first, which is how the desktop client arranges it -- they belong to
 * onboarding rather than to the landing screen.
 *
 * **Phone**: no artwork, no lockup, the step filling the screen.
 *
 * Keyed on width rather than platform, because a tablet in landscape takes the desktop design.
 */
export function OnboardingChrome({ children, testID }: { children: ReactNode; testID: string }) {
  const wide = useMedia().gtSm

  if (!wide) {
    return (
      <Screen padded testID={testID}>
        <XStack justifyContent="flex-end" minHeight="$7">
          {flag('onboardingLanguageSelect') ? <LanguageButton /> : null}
        </XStack>
        {children}
      </Screen>
    )
  }

  return (
    <Screen testID={testID}>
      <XStack flex={1}>
        {/* A maximum rather than a fixed share: the artwork is decoration, and on a very wide
            window 40% of it is more picture than anyone needs. */}
        <YStack width={HERO_FRACTION} maxWidth={640} testID={ELEMENT.onboarding.hero}>
          <HeroImage />
        </YStack>

        {/* Centred both ways in whatever is left, which is the rule the designs state. */}
        <YStack flex={1} alignItems="center" justifyContent="center" padding="$3">
          <YStack width={COLUMN_WIDTH} gap="$3">
            <OnboardingHeader />
            {children}
          </YStack>
        </YStack>
      </XStack>
    </Screen>
  )
}

/**
 * The lockup and the two links out.
 *
 * The wordmark takes the space between them, so the links stay pinned to the right edge of the
 * column however wide the mark renders.
 */
function OnboardingHeader() {
  const open = (url: string) => {
    void requirePorts().linking.openUrl(url)
  }

  return (
    <XStack alignItems="center" gap="$1" height={30}>
      <SessionBrand size={26} color="var(--primaryColor)" />
      <SessionWordmark size={15} color="var(--textPrimary)" />
      <YStack flex={1} />
      <XStack alignItems="center">
        <Button
          variant="ghost"
          size="sm"
          accessibilityLabel={tr('helpFAQ')}
          testID={ELEMENT.onboarding.faqLink}
          onPress={() => {
            open(FAQ_URL)
          }}
          icon={<Icon name="circleHelp" size="$5" color="$textPrimary" />}
        />
        <Button
          variant="ghost"
          size="sm"
          accessibilityLabel={tr('openPlatformWebsite', { platform: tr('appName') })}
          testID={ELEMENT.onboarding.websiteLink}
          onPress={() => {
            open(WEBSITE_URL)
          }}
          icon={<Icon name="link" size="$5" color="$textPrimary" />}
        />
        {/* Beside the other two, because it is the same kind of control: something about the app
            rather than something about the step you are on. */}
        {flag('onboardingLanguageSelect') ? <LanguageButton /> : null}
      </XStack>
    </XStack>
  )
}
