/* eslint-disable @typescript-eslint/triple-slash-reference --
   A path reference rather than an import, deliberately. These are ambient declarations for the
   bundlers' asset imports, and an `import` of a `.d.ts` is not a thing. Without the reference the
   declarations reach this package's own program and no other, so every consumer that typechecks
   these sources -- screens and both apps -- fails on the .png and .ttf imports below. */
/// <reference path="./assets.d.ts" />
import { config } from './config'
import robotoBold from '../assets/fonts/Roboto-Bold.ttf'
import robotoMedium from '../assets/fonts/Roboto-Medium.ttf'
import robotoRegular from '../assets/fonts/Roboto-Regular.ttf'

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

/**
 * Roboto, shipped rather than assumed.
 *
 * It is the face the desktop client uses, and it is not installed on macOS or on most Windows
 * machines -- so naming it in the font stack without shipping it silently falls through to whatever
 * the platform's default is, which is how this app was drawing a serif. Three weights, because the
 * type scale asks for regular, semibold and bold and nothing else.
 */
const FONT_FACES = [
  { weight: 400, src: robotoRegular },
  { weight: 500, src: robotoMedium },
  { weight: 700, src: robotoBold },
]
  .map(
    ({ weight, src }) => `@font-face {
  font-family: 'Roboto';
  font-style: normal;
  font-weight: ${String(weight)};
  /* Nothing is drawn in a fallback face and then reflowed: the text is the layout on these
     screens, and a swap moves every button under the cursor. */
  font-display: block;
  src: url('${src}') format('truetype');
}`,
  )
  .join('\n')

if (!document.getElementById(ID)) {
  const style = document.createElement('style')
  style.id = ID
  style.textContent = `${FONT_FACES}\n${config.getCSS()}`
  // Prepended, not appended: index.html's own rules come after and must keep winning, and so must
  // anything a component inserts at runtime.
  document.head.prepend(style)
}
