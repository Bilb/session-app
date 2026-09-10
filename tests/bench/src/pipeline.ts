import {
  createSessionClient,
  type BridgeTransport,
  type Frame,
  type SessionEvent,
} from '@session/client'

/**
 * The real delivery path, with the transport replaced and nothing else.
 *
 * Frames are the shim's own structs, so nothing is decoded here any more - what is left is the
 * facade's routing to its listeners, which is the part that was never the wire format's to pay.
 * Feeding frames into the real `createSessionClient` costs one function call of overhead and
 * measures what actually runs, rather than a copy of it written to be measurable.
 */
export interface Loopback {
  /** Hand the facade a frame exactly as an adapter's sink would. */
  push: (frame: Frame) => void
  /** Every event the facade broadcast, in order. Cleared by `drain`. */
  events: SessionEvent[]
  drain: () => SessionEvent[]
  close: () => void
}

export function loopback(): Loopback {
  let sink: ((frame: Frame) => void) | null = null

  const transport: BridgeTransport = {
    send() {
      // Nothing goes down in a decode benchmark; requests are measured separately.
    },
    setSink(onFrame) {
      sink = onFrame
    },
    close() {
      sink = null
    },
  }

  const client = createSessionClient(transport)
  const events: SessionEvent[] = []
  const unsubscribe = client.onEvent((event) => events.push(event))

  return {
    push(frame) {
      if (!sink) throw new Error('the facade never installed a sink')
      sink(frame)
    },
    events,
    drain() {
      return events.splice(0, events.length)
    },
    close() {
      unsubscribe()
      client.close()
    },
  }
}

/** One frame through the whole facade, returning what a listener would have been handed. */
export function deliverOne(pipe: Loopback, frame: Frame): SessionEvent {
  pipe.drain()
  pipe.push(frame)
  const event = pipe.events[0]
  if (!event) throw new Error('the frame produced no event')
  pipe.drain()
  return event
}
