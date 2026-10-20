import { Text, type TextProps } from './Text'

/** One line of text that shrinks to fit its box, which iOS and Android do themselves. */
export function FitText(props: TextProps) {
  // The one place the prop belongs: this is what everything else is pointed at instead.
  // eslint-disable-next-line no-restricted-syntax
  return <Text {...props} numberOfLines={1} adjustsFontSizeToFit />
}
