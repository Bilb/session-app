/**
 * The react-native prop vocabulary translated into the DOM one.
 *
 * Both apps need this: the Electron renderer draws through react-native-web, so a component
 * written with native prop names has to arrive at an <input> with names it understands.
 * Keeping the mapping in one file is what stops each component inventing its own.
 */

export type KeyboardType = 'default' | 'email' | 'numeric' | 'phone'

const INPUT_MODE: Record<KeyboardType, string> = {
  default: 'text',
  email: 'email',
  numeric: 'numeric',
  phone: 'tel',
}

const NATIVE_KEYBOARD: Record<KeyboardType, string> = {
  default: 'default',
  email: 'email-address',
  numeric: 'numeric',
  phone: 'phone-pad',
}

export function keyboardTypeToInputMode(type: KeyboardType | undefined): string | undefined {
  return type === undefined ? undefined : INPUT_MODE[type]
}

export function keyboardTypeToNative(type: KeyboardType | undefined): string | undefined {
  return type === undefined ? undefined : NATIVE_KEYBOARD[type]
}

export function domInputType(secure: boolean | undefined): string {
  return secure === true ? 'password' : 'text'
}
