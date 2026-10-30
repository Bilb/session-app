import type { AnyStory } from '../story'
import { albumFocus, albumLone, albumOverflow, albumRows } from './album'
import { button, buttonOnAccent, buttonSizes } from './button'
import { fileRow, fileRowOnAccent, fileRowReceived } from './fileRow'
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
  fileRowReceived,
  radio,
  avatar,
  progressRing,
  textScale,
  albumFocus,
  albumLone,
  albumRows,
  albumOverflow,
]
