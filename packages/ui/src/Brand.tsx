import Svg, { Path } from 'react-native-svg'

/**
 * The two halves of the Session lockup, drawn as paths rather than shipped as images.
 *
 * They are one-colour marks, so a path costs a few hundred bytes and takes a theme token the way
 * everything else does. A PNG would need one file per colour and per density, and would still be
 * the wrong colour in a theme nobody has drawn yet.
 *
 * Paths taken from the desktop client's icon set so the mark is identical rather than similar.
 */

interface MarkProps {
  /** Height in pixels. The width follows the mark's own proportions. */
  size: number
  color: string
}

/** The looping glyph. Drawn in the accent colour, which is what makes it the brand mark. */
export function SessionBrand({ size, color }: MarkProps) {
  return (
    <Svg width={(size * 30) / 34} height={size} viewBox="0 0 30 34" fill={color}>
      <Path d="m25.08 17.26-6.21-3.4h4.2c1.77 0 3.45-.7 4.7-1.93a6.53 6.53 0 0 0 0-9.28 6.67 6.67 0 0 0-4.7-1.93H8.4c-2.2 0-4.32.87-5.88 2.41A8.2 8.2 0 0 0 .08 8.95a8.84 8.84 0 0 0 4.64 7.79l6.2 3.4h-4.2a6.7 6.7 0 0 0-6.2 4.04 6.51 6.51 0 0 0 3.63 8.62 6.7 6.7 0 0 0 2.56.48h14.7c2.2 0 4.3-.87 5.86-2.42a8.2 8.2 0 0 0 2.44-5.81 8.84 8.84 0 0 0-4.63-7.79ZM5.7 14.96A6.91 6.91 0 0 1 2.14 9.1a6.35 6.35 0 0 1 6.4-6.35h14.4a4.65 4.65 0 0 1 4.71 4.3 4.5 4.5 0 0 1-2.77 4.4c-.57.24-1.18.36-1.8.36h-8.3c-.24 0-.47.1-.64.27a.9.9 0 0 0-.27.64v6.7l-8.16-4.47Zm15.53 16.28H6.84a4.64 4.64 0 0 1-4.7-4.3 4.5 4.5 0 0 1 2.77-4.4 4.62 4.62 0 0 1 1.8-.36h8.3a.93.93 0 0 0 .84-.56.9.9 0 0 0 .07-.35v-6.7l8.16 4.47a6.91 6.91 0 0 1 3.57 5.85 6.35 6.35 0 0 1-6.4 6.35Z" />
    </Svg>
  )
}

/** The word SESSION. Drawn in the text colour, not the accent -- it is a word, not a logo. */
export function SessionWordmark({ size, color }: MarkProps) {
  return (
    <Svg width={(size * 766.2) / 102.3} height={size} viewBox="0 0 766.2 102.3" fill={color}>
      <Path d="M0 68h26c-1 7 8 13 28 14 19 0 33-3 33-11 0-19-85 3-85-39C2 12 23 0 54 0c32 0 54 13 54 34H82c0-7-7-14-26-14-17 0-30 3-30 11 0 18 85-2 85 39 0 20-22 32-55 32-34 0-56-13-56-34M126 2h95v21h-71v18h70v19h-70v20h71v20h-95V2zm108 66h26c0 7 8 13 28 14 19 0 33-3 33-11 0-19-84 3-84-39 0-20 20-32 51-32 32 0 54 13 54 34h-25c0-7-7-14-27-14-17 0-29 3-29 11 0 18 84-2 84 39 0 20-22 32-55 32-34 0-56-13-56-34m120 0h26c0 7 8 13 28 14 19 0 33-3 33-11 0-19-85 3-85-39 0-20 21-32 52-32 32 0 54 13 54 34h-26c1-7-7-14-26-14-17 0-29 3-29 11 0 18 84-2 84 39 0 20-22 32-55 32-34 0-56-13-56-34M480 2h24v98h-24V2zm136 49c0-20-14-31-37-31-24 0-38 11-38 31s14 31 38 31c23 0 37-11 37-31m-99 0c0-31 24-51 62-51s61 20 61 51-23 51-61 51-62-20-62-51M654 2h20l68 62V2h24v98h-20l-69-62v62h-24V2z" />
    </Svg>
  )
}
