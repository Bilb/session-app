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
    /**
     * Every state here is the table in `docs/THEMING.md` and the derivation page, which is the
     * spec this is meant to implement: four variants against default, hover, pressed and disabled.
     * It had drifted -- outline hovered onto a surface where the table inverts it, and disabled was
     * a flat opacity where the table names roles -- which is the kind of drift nobody sees until
     * the two are put side by side.
     */
    variant: {
      solid: {
        backgroundColor: '$primaryColor',
        borderColor: '$primaryColor',
        hoverStyle: { backgroundColor: '$accentHover', borderColor: '$accentHover' },
        pressStyle: { backgroundColor: '$accentPressed', borderColor: '$accentPressed' },
      },
      /**
       * Hover **inverts** rather than tinting: the outline fills with the text colour and the label
       * takes the page. An outline control on white has no headroom to brighten into, so a surface
       * step is nearly invisible there -- inverting works in both polarities.
       */
      outline: {
        backgroundColor: 'transparent',
        borderColor: '$textPrimary',
        hoverStyle: { backgroundColor: '$textPrimary', borderColor: '$textPrimary' },
        pressStyle: { backgroundColor: '$textPrimary', borderColor: '$textPrimary', opacity: 0.82 },
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
       * Text on its own, no frame -- what the desktop client calls Simple and uses for every modal
       * action. Its hover dims the label rather than lighting a surface, because there is no
       * surface to light.
       */
      simple: {
        backgroundColor: 'transparent',
        borderColor: 'transparent',
        hoverStyle: { opacity: 0.7 },
        pressStyle: { opacity: 0.55 },
      },
      /** Danger text on a transparent ground, filling on hover. The table's destructive row. */
      danger: {
        backgroundColor: 'transparent',
        borderColor: '$dangerColor',
        hoverStyle: { backgroundColor: '$dangerColor', borderColor: '$dangerColor' },
        pressStyle: { backgroundColor: '$dangerColor', borderColor: '$dangerColor', opacity: 0.82 },
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
    /**
     * Named roles rather than an opacity, which is what the table says and what a theme can act on.
     * A blanket `opacity: .5` dims a disabled control toward whatever is behind it, so on a
     * recessed surface it fades further than on the page -- and it takes the border with it.
     */
    disabled: {
      true: {
        pointerEvents: 'none',
        backgroundColor: 'transparent',
        borderColor: '$bordersColor',
      },
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
  danger: '$dangerColor',
} as const

/**
 * What the label becomes on hover, for the variants whose fill arrives then.
 *
 * Only the inverting ones need it: an outline that fills with the text colour has to stop drawing
 * its label in that same colour, or the label disappears into the fill it is sitting on.
 */
const LABEL_HOVER = {
  outline: '$backgroundPrimary',
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
          color={
            disabled || loading
              ? '$textDisabled'
              : destructive
                ? '$dangerColor'
                : LABEL_TONE[variant]
          }
          {...(variant in LABEL_HOVER
            ? { hoverStyle: { color: LABEL_HOVER[variant as keyof typeof LABEL_HOVER] } }
            : {})}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </Frame>
  )
}
