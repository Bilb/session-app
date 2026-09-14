import { flag } from '@session/app'
import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import {
  Button,
  HeroImage,
  Icon,
  IconRing,
  Screen,
  SessionBrand,
  SessionWordmark,
  useMedia,
  XStack,
  YStack,
} from '@session/ui'
import { useEffect, useState, type ReactNode } from 'react'

import { LanguageButton } from '../LanguageButton'
import { useConfirmUrl } from './ConfirmUrl'

/**
 * The pixel size both header rings are drawn at.
 *
 * One number for both, because `circleHelp` brings its own ring and `IconRing` draws the other:
 * they share a viewBox, so equal boxes make equal circles and unequal boxes make the difference
 * that kept being reported.
 */
const RING_SIZE = 22

/**
 * How long the content takes to fade in when a step changes.
 *
 * The desktop client's `--duration-fadein`. Long enough to read as a transition rather than a
 * flicker, which is what makes moving between steps feel like one screen changing its mind rather
 * than four screens replacing each other.
 */
const FADE_MS = 400

/**
 * Fades from nothing to full whenever `key` changes.
 *
 * Two frames, not an easing curve: the opacity is handed to a tamagui stack, which animates it for
 * us. Written by hand rather than with an animation library because this is the only thing in the
 * app that needs it and a driver is a dependency.
 */
function useFadeIn(key: string): number {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    setShown(false)
    // Next frame rather than immediately: setting both values in one tick gives no transition to
    // interpolate and the content simply appears.
    const raf = setTimeout(() => {
      setShown(true)
    }, 16)
    return () => {
      clearTimeout(raf)
    }
  }, [key])
  return shown ? 1 : 0
}

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
  // Fades the content in when the step changes. `testID` is the step's identity, so a new step
  // remounts this and the animation runs; the artwork and the lockup sit outside it and do not.
  // Desktop only: the mobile clients cut between steps, and an opacity with nothing interpolating
  // it is a frame of invisible content rather than a transition.
  const fading = useFadeIn(testID)

  if (!wide) {
    return (
      <Screen padded testID={testID}>
        <XStack justifyContent="flex-end" minHeight="$7">
          {flag('onboardingLanguageSelect') ? <LanguageButton /> : null}
        </XStack>
        {/* `flex` is load-bearing. Without it this box takes its content's height, and a child
            asking for `flex: 1` inside it resolves against nothing and collapses to zero -- which
            drew the landing screen's heading and its conversation straight over the buttons
            underneath. The step is what fills the phone screen, so the box holding it has to. */}
        <YStack flex={1}>{children}</YStack>
      </Screen>
    )
  }

  const column = (
    // Centred both ways in whatever is left, which is the rule the designs state.
    <YStack flex={1} alignItems="center" justifyContent="center" padding="$3">
      <YStack width={COLUMN_WIDTH} gap="$3">
        <OnboardingHeader />
        <YStack
          minHeight={CONTENT_MIN_HEIGHT}
          opacity={fading}
          // No animation driver is configured, so the transition is declared directly. On
          // native this property is ignored and the step simply appears, which is the same
          // thing the mobile clients do -- only Desktop crossfades.
          style={{ transition: `opacity ${String(FADE_MS)}ms ease-out` }}
        >
          {children}
        </YStack>
      </YStack>
    </YStack>
  )

  return (
    <Screen testID={testID}>
      <XStack flex={1}>
        {/* A maximum rather than a fixed share: the artwork is decoration, and on a very wide
            window 40% of it is more picture than anyone needs. */}
        <YStack width={HERO_FRACTION} maxWidth={640} testID={ELEMENT.onboarding.hero}>
          <HeroImage />
        </YStack>
        {column}
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
 * The designs show both links as a glyph inside a thin circle. lucide has no bare question mark --
 * every help glyph carries its own shape -- so the FAQ ring comes free with `circleHelp`, and the
 * website's is drawn at lucide's own stroke width to match it. The desktop client has only the FAQ
 * button and no website one at all, so the second is a design addition rather than a port.
 */
function OnboardingHeader() {
  // Confirmed before leaving, like every other link here. The desktop client routes its FAQ button
  // through the same dialog rather than opening the browser from the button.
  const open = useConfirmUrl()

  return (
    <XStack alignItems="center" gap="$1" height={30}>
      <SessionBrand size={26} color="$primaryColor" />
      <SessionWordmark size={15} color="$textPrimary" />
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
          // An explicit number rather than a token, because the ring beside it has to be drawn at
          // the same pixel size for the two circles to match -- and `IconRing` takes a number.
          icon={<Icon name="circleHelp" size={RING_SIZE} color="$textPrimary" />}
        />
        {/* Ghost like its neighbour, with the ring drawn rather than bordered -- a CSS border is
            visibly a different weight beside a glyph's own stroke. */}
        <Button
          variant="ghost"
          size="xs"
          circular
          accessibilityLabel={tr('openPlatformWebsite', { platform: tr('appName') })}
          testID={ELEMENT.onboarding.websiteLink}
          onPress={() => {
            open(WEBSITE_URL)
          }}
          icon={
            <IconRing size={RING_SIZE} color="$textPrimary">
              {/* A rung down from the ? glyph's own mark: inside a ring this size, 16 crowds the
                  stroke and 12 sits in it. */}
              <Icon name="link" size="$2" color="$textPrimary" />
            </IconRing>
          }
        />
      </XStack>
    </XStack>
  )
}
