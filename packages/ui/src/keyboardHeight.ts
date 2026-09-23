import { useEffect, useState } from 'react'
import { Keyboard, type KeyboardEvent } from 'react-native'

/**
 * How much of the window the keyboard is currently covering.
 *
 * react-native's own `Keyboard` rather than the keyboard-controller used elsewhere, because the
 * callers have no `.native` pair and the controller would not resolve in the desktop bundle. It is
 * a no-op on the web, which is right there.
 *
 * Both event pairs are listened for because neither platform sends both: iOS has the `Will`
 * events and Android only the `Did` ones.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0)
  useEffect(() => {
    const shown = (event: KeyboardEvent) => {
      setHeight(event.endCoordinates.height)
    }
    const hidden = () => {
      setHeight(0)
    }
    const subscriptions = [
      Keyboard.addListener('keyboardWillShow', shown),
      Keyboard.addListener('keyboardDidShow', shown),
      Keyboard.addListener('keyboardWillHide', hidden),
      Keyboard.addListener('keyboardDidHide', hidden),
    ]
    return () => {
      for (const subscription of subscriptions) subscription.remove()
    }
  }, [])
  return height
}
