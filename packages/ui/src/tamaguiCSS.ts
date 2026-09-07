import { config } from './config'

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

if (!document.getElementById(ID)) {
  const style = document.createElement('style')
  style.id = ID
  style.textContent = config.getCSS()
  // Prepended, not appended: index.html's own rules come after and must keep winning, and so must
  // anything a component inserts at runtime.
  document.head.prepend(style)
}
