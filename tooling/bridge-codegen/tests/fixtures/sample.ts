/** A small protocol exercising every construct the generator accepts. */

/** Binary that is wiped when it goes. An alias on this side; a distinct type on the C++ side. */
export type SecretBytes = Uint8Array

/** Colours, spelled the way libsession spells them. */
export type Colour = 'red' | 'light-blue'

export interface Point {
  x: number
  y: number
}

export interface Shape {
  /** Where it sits. */
  origin: Point
  colour: Colour
  label?: string
  vertices: Point[]
  tags?: string[]
  filled: boolean
}

/** The two binary kinds, in their own struct so the shape above keeps its reviewed signature. */
export interface Attachment {
  /** Ordinary binary: a plain vector on the C++ side. */
  data: Uint8Array
  /** Binary the C++ side wipes rather than merely dropping. */
  key?: SecretBytes
}

type EventArms = { type: 'shape-added'; shape: Shape } | { type: 'cleared' }

/** What the canvas reports. */
export type CanvasEvent = EventArms | { type: 'moved'; id: number; to?: Point }

export type Command =
  /** Draws one shape. */
  { type: 'draw'; shape: Shape } | { type: 'attach'; attachment: Attachment } | { type: 'clear' }

export interface Request {
  id: number
  command: Command
}

export type Frame = { type: 'event'; event: CanvasEvent } | { type: 'ack'; id: number }
