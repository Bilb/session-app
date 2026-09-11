/**
 * What a button's label passes as its colour on the web: nothing of its own.
 *
 * The frame declares the colour for every state -- resting, hovered, pressed -- and the label
 * inherits it, so hover and press need no JavaScript at all. That matters because tracking them by
 * hand cannot be made correct: hover ends on pointer-leave, a press ends on release wherever the
 * pointer happens to be, and a pointer-leave is not reliably delivered while a button is held. Two
 * flags trying to mirror CSS state drifted out of step in both directions -- white label on a white
 * fill, then a dark label on no fill.
 *
 * `.native` says `undefined`, because a react-native `Text` inherits nothing from a `View` and
 * there is no hover on a touch screen to represent.
 */
export const INHERITED_LABEL: 'inherit' | undefined = 'inherit'
