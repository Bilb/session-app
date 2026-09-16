/**
 * Pins an absolutely positioned child to the trailing edge of its parent.
 *
 * **The web half, and it exists because tamagui's `end` prop does not reach the logical property
 * here.** `end` compiles to a class naming `right`, so a slot given it stays on the right of a
 * mirrored layout -- measured: the reveal button sat at the leading edge of a right-to-left field,
 * and setting `inset-inline-end` on the same element moved it to the trailing one. The style wins
 * over the class, which is what makes this the fix rather than a second opinion.
 */
export function trailingInset(value: number): { style: { insetInlineEnd: number } } {
  return { style: { insetInlineEnd: value } }
}
