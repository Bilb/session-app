/**
 * The props both Input variants accept.
 *
 * It lives in a third file so neither variant can quietly grow a prop the other does not
 * have: each one imports this, and a screen typechecks against whichever the bundler
 * resolves. Without it the two drift and only the platform you did not run notices.
 */
export interface InputProps {
  value: string
  onChangeText: (value: string) => void
  placeholder?: string
  /** Mapped to inputMode on the web and keyboardType on native. */
  keyboardType?: 'default' | 'email' | 'numeric' | 'phone'
  autoCapitalize?: 'none' | 'sentences' | 'words'
  secureTextEntry?: boolean
  multiline?: boolean
  autoFocus?: boolean
  disabled?: boolean
  onSubmit?: () => void
  testID?: string
}
