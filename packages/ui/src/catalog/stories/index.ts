import type { AnyStory } from '../story'
import { albumChoices, albumFocus, albumLone, albumOverflow, albumRows } from './album'
import { button, buttonOnAccent, buttonSizes } from './button'
import { composerReply } from './composerReply'
import { fileRow, fileRowOnAccent, fileRowReceived } from './fileRow'
import { messageFrameHighlight } from './messageFrame'
import { avatar, progressRing, radio } from './indicators'
import { messageQuote, messageQuoteAuthors, messageQuoteFiles, messageQuotePictures } from './quote'
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
  stagedTile,
  radio,
  avatar,
  progressRing,
  textScale,
  albumFocus,
  albumLone,
  albumRows,
  albumOverflow,
  albumChoices,
  stagedTray,
  composerNotice,
  dropOverlay,
  mediaViewer,
  messageQuote,
  messageQuotePictures,
  messageQuoteFiles,
  messageQuoteAuthors,
  composerReply,
  messageFrameHighlight,
]
