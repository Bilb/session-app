import { tr } from '@session/localization'
import { Button, type ButtonProps } from '@session/ui'

type Token = Parameters<typeof tr>[0]

/** `tr`'s own parameter list for one token: `[token]`, or `[token, args]` where it takes them. */
type TrParams<T extends Token> = Parameters<typeof tr<T>>

/**
 * A button whose label comes from the catalogue.
 *
 * **Every button in the app has a translated label**, so every call site repeats the same `tr()`
 * inside the same `<Button>`. The repetition is where a hard-coded label hides: a string that
 * never went through `tr` reads exactly like one that did.
 *
 * Here rather than in `@session/ui`, which cannot import the catalogue -- a component that knows
 * the strings is one only this app can use. Same reason as `LanguageButton`.
 *
 * The token and its substitutions are taken as `tr` takes them, so a token that needs arguments
 * cannot be written without them and one that takes none cannot be given any.
 */
type TextButtonProps<T extends Token> = Omit<ButtonProps, 'children'> & {
  label: TrParams<T>
}

export function TextButton<T extends Token>({ label, ...button }: TextButtonProps<T>) {
  return <Button {...button}>{tr(...label)}</Button>
}
