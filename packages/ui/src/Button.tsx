import type { ReactNode } from 'react'
import { Spinner, styled, XStack } from 'tamagui'

import { Text } from './Text'

const Frame = styled(XStack, {
  name: 'Button',
  role: 'button',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '$1',
  borderRadius: '$full',
  borderWidth: 1,
  cursor: 'pointer',
  // A label is not text you select; dragging across a control should do nothing. The desktop
  // client sets the same thing on its button for the same reason.
  userSelect: 'none',

  variants: {
    variant: {
      solid: {
        backgroundColor: '$primaryColor',
        borderColor: '$primaryColor',
        hoverStyle: { backgroundColor: '$accentHover', borderColor: '$accentHover' },
        pressStyle: { backgroundColor: '$accentPressed', borderColor: '$accentPressed' },
      },
      outline: {
        backgroundColor: 'transparent',
        borderColor: '$textPrimary',
        // A surface rather than a brightness step: an outline control on white has no headroom to
        // brighten into, so both states come off the surface ladder. The desktop client uses its
        // text colour at 30% for the hover, which is the same idea by a different route.
        hoverStyle: { backgroundColor: '$backgroundTertiary' },
        pressStyle: { backgroundColor: '$backgroundNested' },
      },
      /**
       * The outline, in the accent rather than in the text colour.
       *
       * What the legacy client draws beside its filled primary button on the landing screen --
       * stroke *and* label in the primary colour, so the pair reads as one accented group with one
       * of them filled. Outlined in the text colour instead, the quieter half reads as a secondary
       * action of a different family rather than as the other half of a pair.
       */
      outlineAccent: {
        backgroundColor: 'transparent',
        borderColor: '$primaryColor',
        color: '$primaryColor',
        hoverStyle: {
          backgroundColor: '$primaryColor',
          borderColor: '$primaryColor',
          color: '$onAccent',
        },
        pressStyle: {
          backgroundColor: '$primaryColor',
          borderColor: '$primaryColor',
          color: '$onAccent',
          opacity: 0.82,
        },
      },
      ghost: {
        backgroundColor: 'transparent',
        borderColor: 'transparent',
        hoverStyle: { backgroundColor: '$backgroundTertiary' },
        pressStyle: { backgroundColor: '$backgroundNested' },
      },
      /**
       * Text on its own, no frame -- what the desktop client calls Simple and uses for every
       * modal action. Its hover dims the label rather than lighting a surface, because there is
       * no surface to light.
       */
      simple: {
        backgroundColor: 'transparent',
        borderColor: 'transparent',
        hoverStyle: { opacity: 0.7 },
        pressStyle: { opacity: 0.55 },
      },
      danger: {
        backgroundColor: '$dangerColor',
        borderColor: '$dangerColor',
        hoverStyle: { opacity: 0.85 },
        pressStyle: { opacity: 0.7 },
      },
    },
    size: {
      // `xs` is for an icon on its own, where the ladder's next rung up is bigger than any glyph
      // needs. It is not a smaller text button: there is no padding on it worth speaking of.
      xs: { height: '$5', paddingHorizontal: '$1' },
      sm: { height: '$6', paddingHorizontal: '$2' },
      md: { height: '$7', paddingHorizontal: '$2.5' },
      lg: { height: '$8', paddingHorizontal: '$3' },
    },
    /**
     * Square, so the full radius draws a circle rather than a pill.
     *
     * Applied after `size` so the padding it clears is that variant's -- tamagui merges variants in
     * declaration order, and a circle with a pill's padding is neither.
     */
    circular: {
      // The width follows the height rather than naming a token of its own, so a circular button
      // stays circular at whichever size it is given.
      true: { aspectRatio: 1, paddingHorizontal: 0 },
    },
    disabled: {
      true: { opacity: 0.5, pointerEvents: 'none' },
    },
  } as const,

  defaultVariants: { variant: 'solid', size: 'md' },
})

/**
 * Label colour follows the variant.
 *
 * A filled button's label sits on the fill, not on the page, so it takes the fill's own on-colour
 * rather than the body text. The body text is white in the dark themes, and white on the accent
 * green measures about 1.6:1.
 */
const LABEL_TONE = {
  solid: '$onAccent',
  outline: '$textPrimary',
  outlineAccent: '$primaryColor',
  ghost: '$textPrimary',
  simple: '$textPrimary',
  danger: '$onDanger',
} as const

export interface ButtonProps {
  children?: ReactNode
  onPress?: () => void
  variant?: keyof typeof LABEL_TONE
  size?: 'xs' | 'sm' | 'md' | 'lg'
  /** For an icon on its own: equal width and height, so the full radius is a circle. */
  circular?: boolean
  /**
   * Overrides the size variant's horizontal padding.
   *
   * For a control whose content is already the right width -- a flag and a chevron, say -- where
   * the variant's padding is what makes it look further from its neighbours than it is.
   */
  paddingHorizontal?: number
  /**
   * Colour the label danger without filling the button.
   *
   * Every destructive action in a modal is drawn this way in the desktop client -- red text beside
   * plain text, no fill on either. A filled red button in a dialog reads as the safe default
   * because it is the one that looks like a primary action.
   */
  destructive?: boolean
  disabled?: boolean
  loading?: boolean
  icon?: ReactNode
  /**
   * What a screen reader announces. Needed whenever the button is drawn as an icon alone: the
   * glyph carries the meaning for everyone who can see it and nothing at all for anyone who
   * cannot.
   *
   * Passed down as `aria-label`, which is the name tamagui takes on both platforms - it maps it
   * to `accessibilityLabel` itself on native. Spelling it the react-native way here reached the
   * DOM as nothing whatsoever, which an icon-only button cannot afford.
   */
  accessibilityLabel?: string
  testID?: string
}

export function Button({
  children,
  onPress,
  variant = 'solid',
  size = 'md',
  disabled = false,
  loading = false,
  circular = false,
  destructive = false,
  paddingHorizontal,
  icon,
  accessibilityLabel,
  testID,
}: ButtonProps) {
  return (
    <Frame
      variant={variant}
      size={size}
      circular={circular}
      {...(paddingHorizontal === undefined ? {} : { paddingHorizontal })}
      disabled={disabled || loading}
      onPress={onPress}
      aria-label={accessibilityLabel}
      testID={testID}
    >
      {loading ? (
        <Spinner size="small" color={destructive ? '$dangerColor' : LABEL_TONE[variant]} />
      ) : (
        icon
      )}
      {typeof children === 'string' ? (
        <Text
          size={size === 'xs' || size === 'sm' ? '$label' : '$body'}
          // Bold, which is what the desktop client's button is: `font-weight: 700` unless a caller
          // says otherwise, and none of the onboarding callers do.
          weight="bold"
          color={destructive ? '$dangerColor' : LABEL_TONE[variant]}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </Frame>
  )
}
