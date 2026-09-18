import { useState, type ReactNode } from 'react'
import { Spinner, styled, XStack } from 'tamagui'

import { INHERITED_LABEL } from './labelColor'
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
        color: '$onAccent',
        pressStyle: { opacity: 0.8 },
      },
      /**
       * Inverts on hover and press -- the outline fills, the label takes the page -- because a
       * surface step is not reliably visible: an outline on white has no headroom to brighten into,
       * and a parent already on `$backgroundTertiary` leaves the step going nowhere.
       */
      outline: {
        backgroundColor: 'transparent',
        borderColor: '$textPrimary',
        color: '$textPrimary',
        hoverStyle: {
          backgroundColor: '$textPrimary',
          borderColor: '$textPrimary',
          color: '$backgroundPrimary',
        },
        pressStyle: {
          backgroundColor: '$textPrimary',
          borderColor: '$textPrimary',
          color: '$backgroundPrimary',
          opacity: 0.82,
        },
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
      /** Two steps, because one is invisible inside a list row that hovers to the same surface. */
      ghost: {
        backgroundColor: 'transparent',
        borderColor: 'transparent',
        color: '$textPrimary',
        hoverStyle: { backgroundColor: '$backgroundTertiary' },
        pressStyle: { backgroundColor: '$backgroundNested' },
      },
      danger: {
        backgroundColor: '$dangerColor',
        borderColor: '$dangerColor',
        color: '$onDanger',
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

/**
 * The label colour while held, for the variants that replace the ground under it.
 *
 * Native only: a `Text` inherits nothing from a `View`, so `color` inside `pressStyle` reaches the
 * frame alone. The web label inherits instead -- see labelColor.ts. A variant that only moves the
 * surface behind the label needs no entry, since the resting colour reads against both.
 */
const PRESSED_LABEL: Partial<Record<keyof typeof LABEL_TONE, string>> = {
  outline: '$backgroundPrimary',
  outlineAccent: '$onAccent',
}

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
  // Only ever true on native: the web label is `'inherit'` and never consults this. Press is the
  // whole of the state there -- a touch screen has no hover -- and the platform delivers both ends
  // of it, which is what makes tracking it here sound where tracking hover would not be.
  const [pressed, setPressed] = useState(false)
  const tone =
    INHERITED_LABEL ?? (pressed ? PRESSED_LABEL[variant] : undefined) ?? LABEL_TONE[variant]

  return (
    <Frame
      variant={variant}
      size={size}
      disabled={disabled || loading}
      onPress={onPress}
      onPressIn={() => {
        setPressed(true)
      }}
      onPressOut={() => {
        setPressed(false)
      }}
      aria-label={accessibilityLabel}
      testID={testID}
    >
      {loading ? <Spinner size="small" color={LABEL_TONE[variant]} /> : icon}
      {typeof children === 'string' ? (
        <Text size={size === 'sm' ? '$label' : '$body'} weight="semibold" color={tone}>
          {children}
        </Text>
      ) : (
        children
      )}
    </Frame>
  )
}
