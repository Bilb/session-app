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

/**
 * How tall every step's content is, whatever is in it.
 *
 * The desktop client's own number, and its comment says why: *"Min height should match the
 * onboarding step with the largest height -- this prevents the loading spinner from jumping around
 * while still keeping things centered."*
 *
 * It belongs on the column rather than on a step, because the whole column is what is centred: the
 * lockup sits above the step, so a step one line shorter than the last moves the lockup too. The
 * client puts it on the steps only, and its own Start screen does move as a result -- this is the
 * same fix applied one level up, which is where it actually holds still.
 */
const CONTENT_MIN_HEIGHT = 276
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
            <YStack minHeight={CONTENT_MIN_HEIGHT}>{children}</YStack>
          </YStack>
        </YStack>
      </XStack>
    </Screen>
  )
}

/**
 * The lockup and the controls beside it.
 *
 * Order is language, FAQ, website. The wordmark takes the space between, so the controls stay
 * pinned to the right edge of the column however wide the mark renders.
 *
 * ⚠️ The designs show both links as a glyph inside a thin circle, and the two circles get there
 * differently. lucide has no bare question mark -- every help glyph carries its own shape -- so the
 * FAQ ring is the glyph's and the website ring is a button border, sized to match. The desktop
 * client has only the FAQ button and draws it exactly this way; there is no client rendering of the
 * website one to copy. Worth checking against a real instance.
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
      {/* One group of three. The designs give 8px between them; the space ladder has 5 and 10 and
          no 8, so this takes the rung above rather than stepping off the ladder for one row. */}
      <XStack alignItems="center" gap="$1.5">
        {flag('onboardingLanguageSelect') ? <LanguageButton /> : null}
        {/* Ghost, because `circleHelp` brings its own circle: a border here would draw a second
            ring around the first. The glyph is therefore the full control size, where the bordered
            one below has the border at that size and a smaller glyph inside it. */}
        <Button
          variant="ghost"
          size="xs"
          circular
          accessibilityLabel={tr('helpFAQ')}
          testID={ELEMENT.onboarding.faqLink}
          onPress={() => {
            open(FAQ_URL)
          }}
          icon={<Icon name="circleHelp" size="$5" color="$textPrimary" />}
        />
        <Button
          variant="outline"
          size="xs"
          circular
          accessibilityLabel={tr('openPlatformWebsite', { platform: tr('appName') })}
          testID={ELEMENT.onboarding.websiteLink}
          onPress={() => {
            open(WEBSITE_URL)
          }}
          icon={<Icon name="link" size="$2" color="$textPrimary" />}
        />
      </XStack>
    </XStack>
  )
}
