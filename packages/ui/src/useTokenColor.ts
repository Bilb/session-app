import { useTheme } from 'tamagui'

/**
 * A theme token resolved to a colour an SVG can actually use.
 *
 * **`var(--textPrimary)` is a web-only trick and it was being passed to react-native-svg.** On the
 * web a CSS custom property resolves against the stylesheet tamagui writes; on native there is no
 * stylesheet and no `var()`, so the value is not a colour at all and the shape is drawn with
 * nothing. It fails silently and it fails only on one platform, which is the combination that gets
 * a thing shipped: the desktop build looked right the whole time.
 *
 * The lucide icons never had this problem because they arrive wrapped in tamagui's `themed()`,
 * which resolves tokens itself. This is that, for the handful of SVGs written by hand.
 *
 * Takes a token with or without the leading `$`, and passes a literal colour through untouched so
 * a caller with a real value does not have to care.
 */
export function useTokenColor(token: string): string {
  const theme = useTheme()
  if (!token.startsWith('$')) return token
  const name = token.slice(1)
  // Indexed rather than accessed by property, because the theme's typed surface names only the
  // tokens tamagui knows at build time and these are looked up by string.
  const value = (theme as unknown as Record<string, { get: () => string } | undefined>)[name]
  return value?.get() ?? token
}
