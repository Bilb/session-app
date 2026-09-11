import { Input as TamaguiInput, XStack } from 'tamagui'

import type { InputProps } from './Input.types'
import { keyboardTypeToNative } from './nativeProps'

/**
 * The native flavour.
 *
 * Same props as the web one - they share Input.types.ts precisely so they cannot disagree -
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
  end,
  endWidth = 0,
  testID,
}: InputProps) {
  const field = (
    <TamaguiInput
      {...(grow && end === undefined ? { flex: 1 } : {})}
      {...(end === undefined ? {} : { flex: 1 })}
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
      // Room for whatever sits against the trailing edge, so the text does not run under it.
      paddingRight={endWidth === 0 ? '$2' : endWidth}
    />
  )

  if (end === undefined) return field

  return (
    <XStack position="relative" {...(grow ? { flex: 1 } : {})}>
      {field}
      {/* Centred against the field rather than pinned to a corner: the field is one row tall and
          anything in it should sit on the same line as the text. */}
      <XStack
        position="absolute"
        right="$2"
        top={0}
        bottom={0}
        alignItems="center"
        pointerEvents="box-none"
      >
        {end}
      </XStack>
    </XStack>
  )
}
