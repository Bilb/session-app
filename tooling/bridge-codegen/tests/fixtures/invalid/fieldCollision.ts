export type Frame =
  { type: 'ack'; sessionId: string; sessionID: number } | { type: 'event'; n: number }
