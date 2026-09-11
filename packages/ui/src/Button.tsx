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

  variants: {
    variant: {
      solid: {
        backgroundColor: '$primaryColor',
        borderColor: '$primaryColor',
        pressStyle: { opacity: 0.8 },
      },
      outline: {
        backgroundColor: 'transparent',
        borderColor: '$textPrimary',
        // A surface rather than a brightness step: a ghost or outline control on white has no
        // headroom to brighten into, so the pressed state has to come off the surface ladder.
        pressStyle: { backgroundColor: '$backgroundTertiary' },
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
        pressStyle: { backgroundColor: '$backgroundTertiary' },
      },
      danger: {
        backgroundColor: '$dangerColor',
        borderColor: '$dangerColor',
        pressStyle: { opacity: 0.8 },
      },
    },
    size: {
      sm: { height: '$6', paddingHorizontal: '$2' },
      md: { height: '$7', paddingHorizontal: '$2.5' },
      lg: { height: '$8', paddingHorizontal: '$3' },
    },
    /**
     * Square, so the full radius draws a circle rather than a pill.
     *
     * Applied after `size` so its width wins over that variant's horizontal padding -- tamagui
     * merges variants in declaration order, and a pill with a circle's width is neither.
     */
    circular: {
      true: { width: '$6', paddingHorizontal: 0 },
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
  danger: '$onDanger',
} as const

export interface ButtonProps {
  children?: ReactNode
  onPress?: () => void
  variant?: keyof typeof LABEL_TONE
  size?: 'sm' | 'md' | 'lg'
  /** For an icon on its own: equal width and height, so the full radius is a circle. */
  circular?: boolean
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
  icon,
  accessibilityLabel,
  testID,
}: ButtonProps) {
  return (
    <Frame
      variant={variant}
      size={size}
      circular={circular}
      disabled={disabled || loading}
      onPress={onPress}
      aria-label={accessibilityLabel}
      testID={testID}
    >
      {loading ? <Spinner size="small" color={LABEL_TONE[variant]} /> : icon}
      {typeof children === 'string' ? (
        <Text
          size={size === 'sm' ? '$label' : '$body'}
          weight="semibold"
          color={LABEL_TONE[variant]}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </Frame>
  )
}
