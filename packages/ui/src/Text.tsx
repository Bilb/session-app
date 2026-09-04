import { SizableText, styled } from 'tamagui'

/**
 * Text.
 *
 * Built on SizableText rather than Text because that is the one whose `size` prop drives
 * the line height as well as the font size — a plain fontSize leaves a 30px title sitting
 * in a 20px line box.
 */
export const Text = styled(SizableText, {
  name: 'Text',
  color: '$textPrimary',
  fontFamily: '$body',

  variants: {
    tone: {
      primary: { color: '$textPrimary' },
      secondary: { color: '$textSecondary' },
      danger: { color: '$dangerColor' },
      accent: { color: '$primaryColor' },
    },
    weight: {
      regular: { fontWeight: '400' },
      semibold: { fontWeight: '600' },
      bold: { fontWeight: '700' },
    },
  } as const,

  defaultVariants: {
    tone: 'primary',
  },
})
