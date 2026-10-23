import type { AnyStory } from '../story'
import { albumFocus } from './album'
import { button, buttonOnAccent, buttonSizes } from './button'
import { fileRow, fileRowOnAccent } from './fileRow'
import { avatar, progressRing, radio } from './indicators'
import { settingsRow } from './settingsRow'
import { textScale } from './text'

export const STORIES: readonly AnyStory[] = [
  button,
  buttonOnAccent,
  buttonSizes,
  settingsRow,
  fileRow,
  fileRowOnAccent,
  radio,
  avatar,
  progressRing,
  textScale,
  albumFocus,
]
