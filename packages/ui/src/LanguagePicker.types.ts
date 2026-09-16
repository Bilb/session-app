/**
 * One row of the picker.
 *
 * `flag` is a string rather than an icon name because it is an emoji: the set is a hundred-odd
 * country flags, which is a font's job and not something to add to the icon union one at a time.
 */
export interface LanguageChoice {
  value: string
  /** The language's name, written in that language. */
  label: string
  /**
   * Its name in English, where that is a different word. **Searched, never drawn.**
   *
   * A row reads in its own language, which is right for somebody scanning for their own and
   * useless for somebody who cannot read the script it is written in. They know the English name,
   * so the filter takes it too.
   */
  english?: string | null
  flag: string
}

/**
 * The ids a test addresses each part of the picker by.
 *
 * Passed in rather than built here from one prefix, because every id in the app comes out of
 * `@session/test-ids` and an id this component invented by concatenation would be one the registry
 * does not know about -- which is exactly the case a test cannot look up.
 */
export interface LanguagePickerTestIDs {
  trigger: string
  panel: string
  search: string
  close: string
  option: (value: string) => string
}

/**
 * Whether the OS has a per-app language screen to hand over to.
 *
 * When it does, the trigger calls this and no panel opens: the picker has nothing to offer that
 * the OS does not own, and a dropdown whose only row says "go somewhere else" is a step for its
 * own sake. It carried a label for that row until the row existed; the caller now owns the whole
 * of what happens next, confirmation included.
 */
type SystemSettingsHandover =
  { onOpenSystemSettings: () => void } | { onOpenSystemSettings?: never }

/**
 * The props the LanguagePicker accepts.
 *
 * Every piece of text is passed in. This package cannot import `@session/localization` -- the
 * boundary rules say so, and they are right, because a component that reaches for the string
 * catalogue is a component only this app can use. The caller is a screen, which has the catalogue
 * anyway.
 */
interface LanguagePickerBaseProps {
  /** The selected locale, matched against `options[].value`. */
  value: string
  options: readonly LanguageChoice[]
  onChange: (value: string) => void
  /** Names the trigger for a screen reader, since it is drawn as a flag and a chevron. */
  accessibilityLabel: string
  /** Heading for the panel. */
  title: string
  searchPlaceholder: string
  /** Shown in place of the list when a search matches nothing. */
  emptyLabel: string
  closeLabel: string
  /**
   * Sit in a row of icon buttons rather than on its own.
   *
   * The trigger is a flag and a chevron, which is wider than a glyph, so by default it carries a
   * button's horizontal padding. In a row of round icon buttons that padding reads as a gap twice
   * the size of the others, and the control looks further away than it is.
   */
  compact?: boolean
  testIDs: LanguagePickerTestIDs
}

/**
 * `onOpenSystemSettings` being present *is* the capability check, decided by the app rather than
 * guessed at here: iOS lists Preferred Language only for a bundle declaring more than one
 * localization, and Android shows App Language only on 13 or newer for an app shipping a
 * `localeConfig`. Absent means the picker does the work itself, which is also what desktop always
 * does.
 */
export type LanguagePickerProps = LanguagePickerBaseProps & SystemSettingsHandover
