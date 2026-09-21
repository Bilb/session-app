import { URLS } from '@session/app'
import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import {
  Button,
  HeroImage,
  Icon,
  IconRing,
  KeyboardAvoiding,
  SafeArea,
  Screen,
  SessionWordmark,
  XStack,
  YStack,
} from '@session/ui'

import { LanguageButton } from '../LanguageButton'
import { OnboardingMark } from './OnboardingMark'
import {
  CONTENT_MIN_HEIGHT,
  FADE_MS,
  HEADER_HEIGHT,
  HEADER_MARK_SIZE,
  HEADER_WORDMARK_SIZE,
  RING_SIZE,
} from './chromeMetrics'
import type { ChromeProps } from './chromeProps'
import { COLUMN_GROW, COLUMN_WIDTH, HERO_GROW, HERO_MAX_WIDTH } from './heroPanel'
import { useConfirmUrl } from './ConfirmUrl'

/**
 * Onboarding as the desktop client draws it, and as a tablet gets: artwork down one side and a
 * fixed-width column beside it carrying the lockup, the links and the step.
 *
 * The lockup sits above *every* step rather than only the first, which is how the desktop client
 * arranges it -- it belongs to onboarding rather than to the landing screen.
 *
 * `banner` is drawn above the step rather than dropped. The desktop client has no second way
 * into the screen that uses one, which is why it used to be ignored -- but this layout is what a
 * tablet past the breakpoint gets too, and a tablet has the camera the tabs switch to. Ignored,
 * the scan tab was unreachable there and rotating to portrait was the only way back to it.
 */
export function WideChrome({
  children,
  testID,
  banner,
  fading,
}: Pick<ChromeProps, 'children' | 'testID' | 'banner'> & { fading: number }) {
  const column = (
    // Centred both ways in whatever is left, which is the rule the designs state.
    <YStack flex={1} alignItems="center" justifyContent="center" padding="$xl">
      <YStack width={COLUMN_WIDTH} gap="$xl">
        <OnboardingHeader />
        {banner}
        <YStack
          // **A height, not a minimum.** The reserve exists so the lockup and the chevron stay put
          // between steps, and a minimum delivers that only while every step fits inside it -- the
          // notification step does not, its content measuring 382 against this 276 at 1100x760. As
          // a minimum its block grows to 424 and the centring lifts the header clear of where the
          // step before it drew the same header. Fixed, a taller step spills out of the bottom and
          // nothing above it moves.
          height={CONTENT_MIN_HEIGHT}
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
    // **The screen claims no safe area, and the column takes it instead.** Artwork that stops short
    // of the status bar and the home indicator reads as a picture in a frame rather than as the
    // background of the app -- it has to run to the edges of the glass. The column cannot: text
    // under a notch is text nobody can read. So the two are asked separately.
    <Screen testID={testID} edges={[]} avoidsKeyboard={false}>
      <XStack flex={1}>
        {/**
         * **The split is declared, not computed.** These properties state the rule where the
         * frame is known: two fifths of it, and never more than `HERO_MAX_WIDTH`.
         *
         * Asking Yoga rather than asking the window is the point. A width computed in JS comes
         * from a `useWindowDimensions` snapshot, and during a rotation the frame is already
         * moving while that snapshot is still the previous orientation's -- so for those frames
         * the panel is the old width inside a box that is the new one. Derived here, it is
         * whatever the frame currently is, on every frame of the animation.
         */}
        <YStack
          flexBasis={0}
          flexGrow={HERO_GROW}
          flexShrink={1}
          maxWidth={HERO_MAX_WIDTH}
          testID={ELEMENT.onboarding.hero}
        >
          <HeroImage />
        </YStack>
        {/* **Only the column moves for the keyboard.** The frame opts out, because lifting the
            frame lifts the artwork with it -- a picture visibly shrinking while somebody types
            their name into a field it is nowhere near. */}
        {/* **No `minWidth` here, and the reason matters.** That the column never drops below what
            the heading and the buttons need is true by construction: it keeps three of the five
            parts, which is 421 at the narrowest window this branch ever sees. Asserted in the
            tests.

            A `minWidth` would be worse than redundant. Yoga clamps a flex *base size* up to the
            minimum before working out the free space, so with a zero basis the reserve comes off
            the top of every layout and the hero gets two fifths of what is left rather than two
            fifths of the frame -- on an iPad a flat 159 short at every width, which
            is 0.4 x 398. A floor that never binds still changed the answer. */}
        <YStack flexBasis={0} flexGrow={COLUMN_GROW}>
          <SafeArea>
            <KeyboardAvoiding>{column}</KeyboardAvoiding>
          </SafeArea>
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
    <XStack alignItems="center" gap="$xs" height={HEADER_HEIGHT}>
      <OnboardingMark size={HEADER_MARK_SIZE} />
      <SessionWordmark size={HEADER_WORDMARK_SIZE} color="$textPrimary" />
      <YStack flex={1} />
      {/* One group of three, at the 8 the designs give them. */}
      <XStack alignItems="center" gap="$xs">
        <LanguageButton />
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
            open(URLS.faq)
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
            open(URLS.website)
          }}
          icon={
            <IconRing size={RING_SIZE} color="$textPrimary">
              {/* A rung down from the ? glyph's own mark: inside a ring this size, 16 crowds the
                  stroke and 12 sits in it. */}
              <Icon name="link" size="xs" color="$textPrimary" />
            </IconRing>
          }
        />
      </XStack>
    </XStack>
  )
}
