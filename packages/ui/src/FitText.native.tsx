import { Text, type TextProps } from './Text'

/** One line of text that shrinks to fit its box, which iOS and Android do themselves. */
export function FitText(props: TextProps) {
  return <Text {...props} numberOfLines={1} adjustsFontSizeToFit />
}
