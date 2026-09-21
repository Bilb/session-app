/**
 * What a button's label passes as its colour on the web: nothing of its own.
 *
 * The frame declares a colour for every state and the label inherits it, so hover and press need no
 * JavaScript. Tracking hover by hand cannot be made correct -- a pointer-leave is not reliably
 * delivered while a button is held, so flags mirroring CSS state drift in both directions.
 *
 * `.native` says `undefined`: a `Text` inherits nothing from a `View`, and a touch screen has no
 * hover, so there press is the whole of the state and the platform delivers both ends of it.
 */
export const INHERITED_LABEL: 'inherit' | undefined = 'inherit'
