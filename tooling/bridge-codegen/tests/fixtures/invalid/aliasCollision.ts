/** A string-union alias named the way the union member below is generated. */
export type AckFrame = 'a' | 'b'

export type Frame = { type: 'ack'; kind: AckFrame } | { type: 'event'; n: number }
