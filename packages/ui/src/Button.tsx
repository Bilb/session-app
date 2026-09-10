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
    disabled: {
      true: { opacity: 0.5, pointerEvents: 'none' },
    },
  } as const,

  defaultVariants: { variant: 'solid', size: 'md' },
})

/**
 * Label colour follows the variant.
 *
 * A filled button's label sits on the fill, not on the page, so it takes the fill's own on-colour.
 * Both filled variants previously took the body text, which is white in the dark themes -- white
 * on the accent green measures about 1.6:1.
 */
const LABEL_TONE = {
  solid: '$onAccent',
  outline: '$textPrimary',
  ghost: '$textPrimary',
  danger: '$onDanger',
} as const

export interface ButtonProps {
  children?: ReactNode
  onPress?: () => void
  variant?: keyof typeof LABEL_TONE
  size?: 'sm' | 'md' | 'lg'
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
  icon,
  accessibilityLabel,
  testID,
}: ButtonProps) {
  return (
    <Frame
      variant={variant}
      size={size}
      disabled={disabled || loading}
      onPress={onPress}
      aria-label={accessibilityLabel}
      testID={testID}
    >
      {loading ? <Spinner size="small" color={LABEL_TONE[variant]} /> : icon}
      {typeof children === 'string' ? (
        <Text size={size === 'sm' ? '$label' : '$body'} weight="semibold" color={LABEL_TONE[variant]}>
          {children}
        </Text>
      ) : (
        children
      )}
    </Frame>
  )
}
