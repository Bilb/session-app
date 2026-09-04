import type { LUCIDE_ICONS_UNICODE } from './lucideUnicode'

export type IconArg = { __kind: 'icon'; unicode: LUCIDE_ICONS_UNICODE }
export type EmojiArg = { __kind: 'emoji'; value: string }
export type BoldArg = { __kind: 'bold'; value: string }
export type MonoArg = { __kind: 'mono'; value: string }
export type ItalicArg = { __kind: 'italic'; value: string }
export type BidiArg = { __kind: 'bidi'; value: string }

export type SegmentArg = string | IconArg | EmojiArg | BoldArg | MonoArg | ItalicArg | BidiArg

export const icon = (unicode: LUCIDE_ICONS_UNICODE): IconArg => ({ __kind: 'icon', unicode })
export const emoji = (value: string): EmojiArg => ({ __kind: 'emoji', value })
export const bold = (value: string): BoldArg => ({ __kind: 'bold', value })
export const mono = (value: string): MonoArg => ({ __kind: 'mono', value })
export const italic = (value: string): ItalicArg => ({ __kind: 'italic', value })
export const bidi = (value: string): BidiArg => ({ __kind: 'bidi', value })
