import type { ComponentProps } from 'react'

import { SizableText, styled } from 'tamagui'

/**
 * Text.
 *
 * Built on SizableText rather than Text because that is the one whose `size` prop drives
 * the line height as well as the font size - a plain fontSize leaves a 30px title sitting
 * in a 20px line box.
 *
 * **The colour comes from the `tone` variant and never from the base style.** A `color` written
 * alongside the variants below wins over them, so `tone="danger"` rendered as body text - and it
 * did it silently, in the one situation where the colour *is* the message. `defaultVariants` is
 * what makes plain `<Text>` primary, and it is the only thing that should.
 */
export const Text = styled(SizableText, {
  name: 'Text',
  fontFamily: '$body',

  variants: {
    tone: {
      primary: { color: '$textPrimary' },
      secondary: { color: '$textSecondary' },
      danger: { color: '$dangerColor' },
      accent: { color: '$primaryColor' },
      /**
       * Text that names something a person cannot use yet.
       *
       * Its own tone rather than `secondary`, because the two mean different things: muted text is
       * still live, and this is not. Both clients dim exactly the words and leave the border and
       * the surface alone, so a disabled option still reads as a control.
       */
      disabled: { color: '$textDisabled' },
    },
    /**
     * **Roboto has no 600.** Its weights are 100, 300, 400, 500, 700 and 900, so asking for 600
     * gets a browser-synthesised bold -- the regular face algorithmically thickened -- which is
     * blurrier and wider than a drawn one and does not match anything a design tool renders.
     * `semibold` therefore means Medium, which is the weight that actually exists between the two.
     */
    weight: {
      regular: { fontWeight: '400' },
      semibold: { fontWeight: '500' },
      bold: { fontWeight: '700' },
    },
  } as const,

  defaultVariants: {
    tone: 'primary',
  },
})

/** What a `Text` takes, so callers can name one prop without restating the component. */
export type TextProps = ComponentProps<typeof Text>

/** The named steps of the type ramp. Exported because callers pass one through. */
export type TextSize = TextProps['size']
