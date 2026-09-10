/** An interface named the way the union member below is named. */
export interface AckFrame {
  n: number
}

export type Frame = { type: 'ack'; payload: AckFrame } | { type: 'event'; n: number }
