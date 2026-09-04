import type { LUCIDE_ICONS_UNICODE } from './lucideUnicode'

export type TextSegment = { type: 'text'; value: string }
export type IconSegment = { type: 'icon'; unicode: LUCIDE_ICONS_UNICODE; rtlMirror: boolean }
export type EmojiSegment = { type: 'emoji'; value: string }
export type BoldSegment = { type: 'bold'; value: string }
export type MonoSegment = { type: 'mono'; value: string }
export type ItalicSegment = { type: 'italic'; value: string }
export type BidiSegment = { type: 'bidi'; value: string }

export type LocalizedSegment =
  TextSegment | IconSegment | EmojiSegment | BoldSegment | MonoSegment | ItalicSegment | BidiSegment
