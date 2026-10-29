import type { AnyStory } from '../story'
import { albumFocus } from './album'
import { button, buttonOnAccent, buttonSizes } from './button'
import { fileRow, fileRowOnAccent, fileRowReceived } from './fileRow'
import { avatar, progressRing, radio } from './indicators'
import { settingsRow } from './settingsRow'
import { composerNotice, dropOverlay, stagedTile, stagedTray } from './staging'
import { textScale } from './text'
import { mediaViewer } from './viewer'

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
  stagedTile,
  stagedTray,
  composerNotice,
  dropOverlay,
  mediaViewer,
]
