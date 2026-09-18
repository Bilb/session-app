import { Input as TamaguiInput } from 'tamagui'

import type { InputProps } from './Input.types'
import { keyboardTypeToInputMode } from './nativeProps'

/**
 * The web flavour, drawn by react-native-web in the Electron renderer.
 *
 * Tamagui's Input already renders an <input> here, so the only real work is turning the
 * native prop names the shared screens use into the DOM ones.
 */
export function Input({
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
  secureTextEntry,
  multiline,
  autoFocus,
  disabled,
  onSubmit,
  grow = false,
  testID,
}: InputProps) {
  return (
    <TamaguiInput
      {...(grow ? { flex: 1 } : {})}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder ?? ''}
      inputMode={keyboardTypeToInputMode(keyboardType) as never}
      autoCapitalize={autoCapitalize ?? 'sentences'}
      secureTextEntry={secureTextEntry ?? false}
      multiline={multiline ?? false}
      autoFocus={autoFocus ?? false}
      disabled={disabled ?? false}
      {...(onSubmit ? { onSubmitEditing: () => onSubmit() } : {})}
      testID={testID}
      backgroundColor="$backgroundSecondary"
      borderColor="$bordersColor"
      color="$textPrimary"
      placeholderTextColor="$textSecondary"
      borderRadius="$md"
      height="$2xl"
      paddingHorizontal="$md"
    />
  )
}
