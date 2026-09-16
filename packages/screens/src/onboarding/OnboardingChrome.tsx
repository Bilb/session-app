import { flag } from '@session/app'
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
  SessionBrand,
  SessionWordmark,
  Text,
  useMedia,
  XStack,
  YStack,
} from '@session/ui'
import { useEffect, useState, type ReactNode } from 'react'

import { LanguageButton } from '../LanguageButton'
import { NetworkOverlay } from '../NetworkOverlay'
import { COLUMN_RESERVE, COLUMN_WIDTH, HERO_BASIS, HERO_MAX_WIDTH } from './heroPanel'
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
function useFadeIn(key: string, instant: boolean): number {
  const [shown, setShown] = useState(instant)
  useEffect(() => {
    // The flag exists so an automated run is not racing a transition it cannot see. Nothing to
    // schedule and nothing to undo: the content is simply already there.
    if (instant) return
    setShown(false)
    // Next frame rather than immediately: setting both values in one tick gives no transition to
    // interpolate and the content simply appears.
    const raf = setTimeout(() => {
      setShown(true)
    }, 16)
    return () => {
      clearTimeout(raf)
    }
  }, [key, instant])
  return shown ? 1 : 0
}

/**
 * The height every step's content is given, however short it really is.
 *
 * The desktop client's own number, taken from the tallest step, and its comment says what it is
 * for: *"Min height should match the onboarding step with the largest height -- this prevents the
 * loading spinner from jumping around while still keeping things centered."*
 *
 * **It sits on the column rather than on the step, which is where the client puts it.** In the
 * client the reserve is on the back-button wrapper, so only a step with a back button gets it and
 * the landing screen stands at its own height -- the block is then centred at two different heights
 * and the lockup, the heading and the buttons all move as you go from the landing screen to the
 * next one. Here every screen reserves the same box, so the block is one size and the content
 * starts at the same place throughout: nothing jumps, at the cost of the short screens sitting
 * above the middle rather than on it. A product call, and the reason for the difference.
 *
 * That upward bias is the reserve's own doing rather than a separate nudge: short content
 * top-aligns in the box and the empty part of it hangs below. The landing screen, the shortest,
 * reads about 70px high; the steps read about 20px high.
 */
const CONTENT_MIN_HEIGHT = 276

/**
 * The phone design's two horizontal insets.
 *
 * **Both clients use two, not one**, and they agree with each other: the reading column is inset
 * 35 on iOS (`Values.veryLargeSpacing`) and 36 on Android (`mediumSpacing`), and the primary
 * button is inset 64 on both (`massiveSpacing` / `xlargeSpacing`). The relationship is the part
 * worth porting rather than either number: **the button is deliberately narrower than the text it
 * sits under.** Ours was a single 15 everywhere, under half the body inset and under a quarter of
 * the button's.
 *
 * 35 is the space scale's `$4`; 64 is not on the scale and is written as itself, since inventing a
 * rung for one value would make the scale less useful rather than more.
 */
const CONTENT_INSET = 35

/** The legacy client's navigation-bar mark: `SessionGreen32`, pinned to a 32pt square. */
const BAR_LOGO_SIZE = 32
const ACTION_INSET = 64

/** What an action needs on top of the content inset it already sits inside. */
export const EXTRA_ACTION_INSET = ACTION_INSET - CONTENT_INSET

/** The room the narrow chrome leaves around a step. The wide one leaves none -- see below. */
const STEP_PADDING = {
  paddingHorizontal: CONTENT_INSET,
  paddingTop: '$3',
  paddingBottom: '$2',
} as const

/**
 * The same padding, for a pane that has to apply it itself.
 *
 * `LoadAccountScreen` turns `padContent` off because its two panes disagree about the inset -- the
 * field belongs in the reading column and the camera fills the width -- and pads the one that
 * wants it. That left the figure written down in two places and only the narrow half of it was
 * copied: on the wide branch the column is already `COLUMN_WIDTH` and the chrome adds no
 * horizontal inset at all, so the recovery-password step alone drew 70 narrower and 25 lower than
 * every other step on Desktop.
 */
export function useStepPadding(): Partial<typeof STEP_PADDING> {
  return useMedia().gtSm ? {} : STEP_PADDING
}

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
export function OnboardingChrome({
  children,
  testID,
  onBack,
  barTitle,
  banner,
  padContent = true,
  avoidsKeyboard = true,
}: {
  children: ReactNode
  testID: string
  /**
   * Drawn by the **phone** design only, in the row above the step.
   *
   * The wide design hangs its own chevron off the side of the column, outside the content, and
   * ignores this. A phone has no such margin to hang into: the same offset put the control 21
   * points off the left edge of the screen, three of it visible and none of it tappable, so there
   * was no way back from any step. Both mobile clients put it in a bar above the content instead,
   * which is what this row is.
   */
  onBack?: () => void
  /**
   * A word for the screen in the bar, in place of the Session mark.
   *
   * The clients swap the two rather than showing both: the mark is the navigation bar's title
   * view, so a screen that wants a title of its own takes the same slot -- `setNavBarTitle` on the
   * restore screen, against `setUpNavBarSessionIcon` everywhere else.
   */
  barTitle?: string
  /**
   * Drawn full width between the bar and the content, on a phone.
   *
   * For the restore screen's tabs, which the client puts directly under the navigation bar and
   * across the whole width -- outside the reading column, unlike everything else on the screen.
   * The wide designs ignore it: the desktop client has no second way into that screen to offer.
   */
  banner?: ReactNode
  /**
   * Whether the chrome insets what it is given.
   *
   * True for every step, and false for a screen whose panes disagree about it -- the restore
   * screen's recovery field sits in the reading column while its camera fills the width, which is
   * how the client has it. The panes then pad themselves.
   */
  padContent?: boolean
  /**
   * Whether the screen moves out of the keyboard's way.
   *
   * True for every step that has a field. **False for the landing screen**, which has none: the
   * only keyboard it can raise is the language picker's search, and that lives in a modal of its
   * own. On Android the whole activity resizes for it regardless, so without this the Create
   * account and I have an account buttons climb the screen while somebody types in a panel that
   * is over the top of them. A product call.
   */
  avoidsKeyboard?: boolean
}) {
  const wide = useMedia().gtSm
  // Fades the content in when the step changes. `testID` is the step's identity, so a new step
  // remounts this and the animation runs; the artwork and the lockup sit outside it and do not.
  // Desktop only: the mobile clients cut between steps, and an opacity with nothing interpolating
  // it is a frame of invisible content rather than a transition.
  const fading = useFadeIn(testID, flag('disableAnimations'))

  if (!wide) {
    return (
      // Not `padded`: onboarding has its own inset, which is more than twice the screen default
      // and is the clients' own. See the constants.
      <Screen testID={testID} avoidsKeyboard={avoidsKeyboard}>
        {/* The bar the phone design puts above the step. Its controls sit in from the edge by the
            space the platform's own navigation bar uses, not by the hairline the content inset
            would leave them. */}
        <XStack alignItems="center" minHeight="$7" paddingHorizontal="$2" paddingTop="$1">
          {onBack === undefined ? null : (
            <Button
              variant="ghost"
              // `md` rather than `xs`: the glyph is the same, and the control is the size of the
              // touch target rather than of the icon, so the pressed highlight covers what a
              // finger covers. An `xs` button grown only by `hitSlop` presses in a 24pt square
              // inside a 40pt target, which reads as a mis-hit even when it worked.
              size="md"
              circular
              accessibilityLabel={tr('back')}
              testID={ELEMENT.onboarding.back}
              onPress={onBack}
              icon={<Icon name="chevronLeft" size="$5" color="$textPrimary" />}
            />
          )}
          <YStack flex={1} />
          {/* **The Session mark, centred in the bar.** The legacy client puts it there as the
              navigation bar's `titleView` -- the brand mark alone at 32pt, no wordmark -- which is
              why it looked absent here: there is nothing to add to the screen's body, it belongs
              to the chrome. Absolutely positioned so it is centred on the *bar* rather than on
              whatever space the two controls leave, which is what a title view does. */}
          <YStack position="absolute" left={0} right={0} alignItems="center" pointerEvents="none">
            {/* Stamped across the mark on anything that is not a real mainnet build, which is
                where legacy iOS puts it during onboarding too. Worth having here and not only on
                the conversation list: onboarding is where somebody is most likely to wonder which
                network an account is about to be made on. */}
            <NetworkOverlay>
              {barTitle === undefined ? (
                <SessionBrand size={BAR_LOGO_SIZE} color="$primaryColor" />
              ) : (
                <Text size="$bodyLarge" weight="bold">
                  {barTitle}
                </Text>
              )}
            </NetworkOverlay>
          </YStack>
          {flag('onboardingLanguageSelect') ? <LanguageButton /> : null}
        </XStack>
        {/* `flex` is load-bearing. Without it this box takes its content's height, and a child
            asking for `flex: 1` inside it resolves against nothing and collapses to zero -- which
            drew the landing screen's heading and its conversation straight over the buttons
            underneath. The step is what fills the phone screen, so the box holding it has to. */}
        {/* The bar and the title were almost touching. The client leaves a navigation bar's worth
            of air under the logo before the content begins. */}
        {banner}
        <YStack flex={1} {...(padContent ? STEP_PADDING : {})}>
          {children}
        </YStack>
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
    // **The screen claims no safe area, and the column takes it instead.** Artwork that stops short
    // of the status bar and the home indicator reads as a picture in a frame rather than as the
    // background of the app -- it has to run to the edges of the glass. The column cannot: text
    // under a notch is text nobody can read. So the two are asked separately.
    <Screen testID={testID} edges={[]} avoidsKeyboard={false}>
      <XStack flex={1}>
        {/**
         * **The split is declared, not computed.** These three properties are the same rule the
         * panel used to get from a function of the window -- two fifths of the frame, never more
         * than `HERO_MAX_WIDTH`, and never so much that the column drops below what it reserves,
         * which is what the sibling's `minWidth` enforces by making this one give way.
         *
         * Asking Yoga rather than asking the window is the point. A width computed in JS comes
         * from a `useWindowDimensions` snapshot, and during a rotation the frame is already
         * moving while that snapshot is still the previous orientation's -- so for those frames
         * the panel is the old width inside a box that is the new one. Derived here, it is
         * whatever the frame currently is, on every frame of the animation.
         */}
        <YStack
          flexBasis={HERO_BASIS}
          flexGrow={0}
          flexShrink={1}
          maxWidth={HERO_MAX_WIDTH}
          testID={ELEMENT.onboarding.hero}
        >
          <HeroImage />
        </YStack>
        {/* **Only the column moves for the keyboard.** The frame opts out, because lifting the
            frame lifts the artwork with it -- a picture visibly shrinking while somebody types
            their name into a field it is nowhere near. */}
        {/* The column's reserve, and the other half of the rule above: the hero is the one that
            shrinks, because this will not go below what the heading and the buttons need. */}
        <YStack flex={1} minWidth={COLUMN_RESERVE}>
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
    <XStack alignItems="center" gap="$1" height={30}>
      <NetworkOverlay>
        <SessionBrand size={26} color="$primaryColor" />
      </NetworkOverlay>
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
