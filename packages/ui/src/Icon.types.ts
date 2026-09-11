import type { ComponentProps } from 'react'

import type { Plus } from '@tamagui/lucide-icons-2/icons/Plus'

/**
 * Every icon the app draws, and what it is called here.
 *
 * A closed union rather than a string, because the map in `Icon.tsx` is keyed by it: a name with
 * no glyph behind it and a glyph nothing names are both a type error, rather than an icon that
 * silently fails to appear. Adding one is two lines - a member here, an entry there.
 *
 * Named for the glyph in lucide's vocabulary rather than for where it is used. The same icon turns
 * up in more than one place, and a name like `newConversation` is either duplicated or wrong the
 * second time somebody reaches for it.
 */
export type IconName =
  'check' | 'chevronDown' | 'chevronLeft' | 'circleHelp' | 'link' | 'plus' | 'search' | 'settings'

/**
 * Whatever a themed lucide icon accepts, plus which one to draw.
 *
 * Taken from a glyph rather than written out, so `size`, `color` and the style props stay whatever
 * the icon set actually takes across a version bump. They are tamagui's: `size` reads the size
 * scale (`$5` is 24) and `color` reads the theme (`$textSecondary`), so an icon restyles with a
 * theme like everything else.
 */
export type IconProps = ComponentProps<typeof Plus> & {
  name: IconName
}
