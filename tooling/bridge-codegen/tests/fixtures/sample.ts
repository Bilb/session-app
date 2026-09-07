/** A small protocol exercising every construct the generator accepts. */

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

type EventArms = { type: 'shape-added'; shape: Shape } | { type: 'cleared' }

/** What the canvas reports. */
export type CanvasEvent = EventArms | { type: 'moved'; id: number; to?: Point }

export type Command =
  /** Draws one shape. */
  { type: 'draw'; shape: Shape } | { type: 'clear' }

export interface Request {
  id: number
  command: Command
}

export type Frame = { type: 'event'; event: CanvasEvent } | { type: 'ack'; id: number }
