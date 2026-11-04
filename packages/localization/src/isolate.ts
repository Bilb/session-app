/** FIRST STRONG ISOLATE and POP DIRECTIONAL ISOLATE. */
const FSI = '\u2068'
const PDI = '\u2069'

/**
 * One part of a composed line, ordered as a unit and in its own direction, which it takes from its
 * first strong character.
 *
 * A size needs it inside right-to-left text: "180 kB" is a number and then a word, and the number
 * takes the side of the text around it while the word keeps its own, so the two come apart. Isolate
 * every part of the line, not only the size, or a neighbour's direction reaches into the next part.
 *
 * Both marks are default-ignorable: no glyph and no width, in a browser and in native text alike,
 * so measuring and truncating the line are unchanged.
 */
export function isolate(text: string): string {
  return text === '' ? '' : `${FSI}${text}${PDI}`
}
