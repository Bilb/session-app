import type { AnyStory } from '../story'
import { albumChoices, albumFocus, albumLone, albumOverflow, albumRows } from './album'
import { button, buttonOnAccent, buttonSizes } from './button'
import { fileRow, fileRowOnAccent, fileRowReceived } from './fileRow'
import { avatar, buttonProgress, progressRing, radio } from './indicators'
import { settingsRow } from './settingsRow'
import { stagedTile } from './stagedTile'
import { textScale } from './text'

export const STORIES: readonly AnyStory[] = [
  button,
  buttonOnAccent,
  buttonSizes,
  settingsRow,
  fileRow,
  fileRowOnAccent,
  fileRowReceived,
  stagedTile,
  radio,
  avatar,
  progressRing,
  buttonProgress,
  textScale,
  albumFocus,
  albumLone,
  albumRows,
  albumOverflow,
  albumChoices,
]
