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
  /**
   * Take the space the parent offers along its main axis.
   *
   * Off by default, and it has to be a choice rather than built in: `flex: 1` grows the width
   * inside a row and sets `flex-basis: 0` inside a column, where it collapses the field to the
   * height of its own text. A shared component cannot know which direction it was put in.
   */
  grow?: boolean
  testID?: string
}
