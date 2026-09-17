import { Check } from '@tamagui/lucide-icons-2/icons/Check'
import { ChevronDown } from '@tamagui/lucide-icons-2/icons/ChevronDown'
import { ChevronLeft } from '@tamagui/lucide-icons-2/icons/ChevronLeft'
import { ChevronRight } from '@tamagui/lucide-icons-2/icons/ChevronRight'
import { CircleHelp } from '@tamagui/lucide-icons-2/icons/CircleHelp'
import { ExternalLink } from '@tamagui/lucide-icons-2/icons/ExternalLink'
import { Eye } from '@tamagui/lucide-icons-2/icons/Eye'
import { EyeOff } from '@tamagui/lucide-icons-2/icons/EyeOff'
import { Link } from '@tamagui/lucide-icons-2/icons/Link'
import { Plus } from '@tamagui/lucide-icons-2/icons/Plus'
import { Search } from '@tamagui/lucide-icons-2/icons/Search'
import { Settings } from '@tamagui/lucide-icons-2/icons/Settings'
import { X } from '@tamagui/lucide-icons-2/icons/X'

import type { IconName, IconProps, IconSize } from './Icon.types'

/**
 * The glyph behind each name.
 *
 * **Imported one subpath at a time, never from the package barrel.** The barrel pulls in every one
 * of lucide's ~1500 icons; rollup shakes the unused ones out of the desktop bundle but Metro does
 * not, so a barrel import here costs the mobile app 1500 modules it never draws. The subpaths are
 * declared in the package's exports map, and each one resolves to its own web or native build.
 *
 * `satisfies` rather than an annotation, so this is checked against the union without widening what
 * the values are: every name has a glyph, and a glyph nobody named does not compile.
 */
const GLYPHS = {
  check: Check,
  chevronDown: ChevronDown,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  circleHelp: CircleHelp,
  externalLink: ExternalLink,
  eye: Eye,
  eyeOff: EyeOff,
  link: Link,
  plus: Plus,
  search: Search,
  settings: Settings,
  x: X,
} satisfies Record<IconName, typeof Plus>

/**
 * One icon, drawn from the set the app has agreed on.
 *
 * The glyphs arrive already wrapped in tamagui's `themed()`, so `color` takes a token and an icon
 * follows the theme without anything here doing the work. No default size: left alone, an icon
 * takes its size from the sized context it is in - a button sizes the icon inside it - and falls
 * back to lucide's own 24 when there is none.
 */
export function Icon({ name, size, ...rest }: IconProps) {
  const Glyph = GLYPHS[name]
  const resolved = typeof size === 'string' ? ICON_SIZES[size] : size
  return <Glyph {...rest} {...(resolved === undefined ? {} : { size: resolved })} />
}

/**
 * Which rung of the dimension ladder each named size is.
 *
 * One to one with the scale's own names, which is not a coincidence -- an icon's vocabulary was
 * chosen to match it. Written out rather than derived, because what this restricts is *which*
 * rungs an icon may use: the ladder runs to 64 and nothing here should draw a glyph that big.
 */
const ICON_SIZES: Record<IconSize, string> = {
  xs: '$xs',
  sm: '$sm',
  md: '$md',
  lg: '$lg',
  xl: '$xl',
}
