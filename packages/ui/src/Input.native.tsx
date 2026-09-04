import { Input as TamaguiInput } from 'tamagui'

import type { InputProps } from './Input.types'
import { keyboardTypeToNative } from './nativeProps'

/**
 * The native flavour.
 *
 * Same props as the web one — they share Input.types.ts precisely so they cannot disagree —
 * but the keyboard is chosen with keyboardType, and returnKeyType is worth setting because
 * a soft keyboard has no enter key otherwise.
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
      keyboardType={keyboardTypeToNative(keyboardType) as never}
      autoCapitalize={autoCapitalize ?? 'sentences'}
      secureTextEntry={secureTextEntry ?? false}
      multiline={multiline ?? false}
      autoFocus={autoFocus ?? false}
      disabled={disabled ?? false}
      {...(onSubmit ? { onSubmitEditing: () => onSubmit() } : {})}
      returnKeyType={onSubmit ? 'send' : 'default'}
      blurOnSubmit={false}
      testID={testID}
      backgroundColor="$backgroundSecondary"
      borderColor="$bordersColor"
      color="$textPrimary"
      placeholderTextColor="$textSecondary"
      borderRadius="$2"
      height="$7"
      paddingHorizontal="$2"
    />
  )
}
