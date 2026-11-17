/* eslint-disable @typescript-eslint/triple-slash-reference --
   A path reference rather than an import, deliberately. These are ambient declarations for the
   bundlers' asset imports, and an `import` of a `.d.ts` is not a thing. Without the reference the
   declarations reach this package's own program and no other, so every consumer that typechecks
   these sources -- screens and both apps -- fails on the .png and .ttf imports below. */
/// <reference path="./assets.d.ts" />
import { RADII } from '@session/theme-tokens'

import { config } from './config'
import { ROUNDED_SCROLL_ATTRIBUTE } from './roundedScroll'
import { BUNDLED_FACES } from './fontAssets'

/**
 * Puts the configuration's stylesheet in the document, which is what makes a theme a theme here.
 *
 * `createTamagui` does not merely describe the themes, it compiles them: `getCSS()` returns the
 * `.tm_*` classes that map a name to a slot (`--textPrimary: var(--t7)`) and the `:root` block that
 * gives the slots their values. A component asking for `$textPrimary` renders
 * `color: var(--textPrimary)` and nothing else - so with that stylesheet absent the property names
 * nothing, every colour falls back to the browser's own, and the app draws in black on white
 * whatever theme it believes it is showing.
 *
 * Emitting it is normally `@tamagui/vite-plugin`'s job. The plugin is deliberately absent - it
 * peers on a vite the desktop app is not on - and it is an optimising compiler rather than a
 * requirement, so this is the one thing it did that is not an optimisation.
 *
 * At import rather than in an effect, and before React has rendered anything: an effect runs after
 * the first paint, which is one frame of exactly the unthemed app this exists to prevent.
 */
const ID = 'tamagui-css'

/** Every face the desktop bundles, as `@font-face` rules. The list is in `fontAssets.ts`. */
const FONT_FACES = BUNDLED_FACES.map(
  ({ family, weight, src }) => `@font-face {
  font-family: '${family}';
  font-style: normal;
  font-weight: ${weight};
  /* Nothing is drawn in a fallback face and then reflowed: the text is the layout on these
     screens, and a swap moves every button under the cursor. */
  font-display: block;
  src: url('${src}') format('truetype');
}`,
).join('\n')

/**
 * What selected text looks like.
 *
 * The browser's default selection is a blue wash that a dark theme renders as near-invisible: on
 * the language picker's search field, selecting all of it looked exactly like selecting none of it.
 * There is no token for this because nothing else in the app needed one -- the accent at low
 * opacity is the same treatment every other selected surface gets, and it keeps the text readable
 * rather than inverting it.
 */
const SELECTION = `::selection {
  background: color-mix(in srgb, var(--primaryColor) 35%, transparent);
  color: var(--textPrimary);
}`

/**
 * The scrollbar. Its colours are muted text at these alphas, so taking the
 * role keeps them right in every theme; the platform default is a grey gutter on a dark theme.
 */
const SCROLLBAR = `::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track {
  background-color: color-mix(in srgb, var(--textSecondary) 10%, transparent);
  border-radius: 20px;
}
::-webkit-scrollbar-track:hover {
  background-color: color-mix(in srgb, var(--textSecondary) 20%, transparent);
}
::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--textSecondary) 20%, transparent);
  border-radius: 20px;
}
::-webkit-scrollbar-thumb:hover { background: var(--textSecondary); }
::-webkit-scrollbar-corner { background: transparent; }
[${ROUNDED_SCROLL_ATTRIBUTE}]::-webkit-scrollbar-track { margin-block: ${String(RADII.md)}px; }`

/**
 * Each text's direction from its own first letter, its alignment from the layout.
 *
 * The web otherwise gives every text the layout's direction, so under an Arabic layout "Hello!"
 * draws as "!Hello" and "2 of 5 uploaded" as "of 5 uploaded 2", and an Arabic message in an
 * English layout the other way round. Android and iOS already decide each paragraph by its first
 * letter. The prefixed `match-parent` keeps such a line on the layout's side: Chromium computes the
 * plain one to `start`, which is the text's own. `:where` lets any `textAlign` win.
 */
const TEXT_DIRECTION = `:where(.is_Text) { unicode-bidi: plaintext; text-align: -webkit-match-parent; }`

if (!document.getElementById(ID)) {
  const style = document.createElement('style')
  style.id = ID
  style.textContent = `${FONT_FACES}\n${SELECTION}\n${SCROLLBAR}\n${TEXT_DIRECTION}\n${config.getCSS()}`
  // Prepended, not appended: index.html's own rules come after and must keep winning, and so must
  // anything a component inserts at runtime.
  document.head.prepend(style)
}
