import {
  Children,
  Fragment,
  isValidElement,
  type ComponentType,
  type ReactElement,
  type ReactNode,
} from 'react'
import { XStack, YStack } from 'tamagui'

import type { MarkProps } from './Brand'
import { Icon } from './Icon'
import type { IconName } from './Icon.types'
import { logical } from './logicalEdges'
import { PressArea } from './PressArea'
import { PRESS_PASSTHROUGH } from './pressPassthrough'
import { SPACE_SCALE } from './scales'
import { Text } from './Text'

/** A control's rung rather than a text line's: a row is a tap target. */
const ROW_MIN_HEIGHT = 56

/** How wide the leading icon's column is, so labels line up whether or not a row has one. */
const ICON_COLUMN = 24

/**
 * The desktop client's half pixel: a whole one lands on one device pixel or two depending on
 * position, so one group's lines would draw at different weights.
 */
const SEPARATOR = 0.5

export interface SettingsRowProps {
  label: string
  /**
   * Rows in one group either all have one or none do. An element is drawn as given, for a glyph
   * that is not one colour on a square (the Pro badge); the caller sizes and tones it.
   */
  icon?: IconName | ComponentType<MarkProps> | ReactElement
  /** Draws the icon in the accent, for the row the client singles out that way: Donate. */
  accentIcon?: boolean
  /** A second line under the label, for a row whose meaning is not obvious from its name. */
  subtitle?: string
  /** A value, a switch, a button. No chevron by default: the client's rows carry none. */
  trailing?: ReactNode
  /** Tints the label and its icon, for a row that destroys something. */
  destructive?: boolean
  /** Without one the row is static, with nothing to press but its trailing control. */
  onPress?: () => void
  /** For a row whose screen is not built yet. See the component. */
  disabled?: boolean
  testID: string
}

/**
 * One row of a settings list: the desktop client's `PanelButton`.
 *
 * A row whose screen is not built yet is shown `disabled` rather than hidden, so the list keeps its
 * designed order. `disabled` is explicit because a row with no `onPress` may still have a live
 * trailing control.
 */
export function SettingsRow({
  label,
  icon,
  subtitle,
  trailing,
  accentIcon = false,
  destructive = false,
  onPress,
  disabled = false,
  testID,
}: SettingsRowProps) {
  const inert = disabled || onPress === undefined
  const tone = disabled ? '$textDisabled' : destructive ? '$dangerColor' : '$textPrimary'
  // `accentText`, not the accent: as a glyph the accent is too faint on a light ground.
  const iconTone = accentIcon && !disabled ? '$accentText' : tone

  return (
    <PressArea
      {...(onPress === undefined || disabled ? {} : { onPress })}
      disabled={inert}
      testID={testID}
    >
      {(pressed) => (
        // Its own frame, so the state overlays step from the row's surface rather than the page.
        <YStack backgroundColor="$backgroundSecondary">
          <XStack
            minHeight={ROW_MIN_HEIGHT}
            alignItems="center"
            gap="$sm"
            // The side padding matches the separators' inset, so a line starts where content does.
            // Less vertically because a line's own leading adds to it.
            paddingHorizontal="$md"
            paddingVertical="$sm"
            {...(inert
              ? {}
              : {
                  cursor: 'pointer',
                  hoverStyle: { backgroundColor: '$hoverOverlay' },
                  pressStyle: { backgroundColor: '$pressedOverlay' },
                  // Native: without this a frame with a `pressStyle` claims the touch from
                  // `PressArea` and the row never fires. Pressable rows only: it takes the subtree
                  // with it, and on a static row the trailing control is what gets pressed.
                  ...PRESS_PASSTHROUGH,
                  ...(pressed ? { backgroundColor: '$pressedOverlay' } : {}),
                })}
          >
            {icon === undefined ? null : (
              <YStack width={ICON_COLUMN} alignItems="center">
                {typeof icon === 'string' ? (
                  <Icon name={icon} size="lg" color={iconTone} />
                ) : isValidElement(icon) ? (
                  icon
                ) : (
                  // A mark fills its box where a lucide glyph has a margin: a rung smaller.
                  <Mark mark={icon} color={iconTone} />
                )}
              </YStack>
            )}

            <YStack flex={1} gap="$3xs">
              <Text size="$bodyLarge" weight="bold" color={tone}>
                {label}
              </Text>
              {subtitle === undefined ? null : (
                // Unmuted, as the desktop client draws it. Label size so it reads as the name's
                // explanation rather than as a second line of body text.
                <Text size="$label" color={disabled ? '$textDisabled' : '$textPrimary'}>
                  {subtitle}
                </Text>
              )}
            </YStack>

            {trailing === undefined ? null : (
              // More room than icon-to-label, so wrapped label text does not run into the control.
              <YStack
                {...logical({ paddingStart: SPACE_SCALE.xs, paddingEnd: SPACE_SCALE['2xs'] })}
              >
                {trailing}
              </YStack>
            )}
          </XStack>
        </YStack>
      )}
    </PressArea>
  )
}

/** The pixel height a mark is drawn at: the icon ladder's `md`, a rung under the glyphs' `lg`. */
const MARK_SIZE = 20

function Mark({ mark: Drawn, color }: { mark: ComponentType<MarkProps>; color: string }) {
  return <Drawn size={MARK_SIZE} color={color} />
}

/**
 * A run of rows drawn as one block: the client's `PanelButtonGroup`.
 *
 * Separators are drawn here so a row need not know whether it is last, inset from both edges as
 * the client's are: a full-width divider reads as two cards.
 */
export function SettingsGroup({ children }: { children: ReactNode }) {
  const rows = Children.toArray(children)
  return (
    <YStack borderRadius="$md" overflow="hidden" backgroundColor="$backgroundSecondary">
      {rows.map((row, at) => (
        <Fragment key={at}>
          {at === 0 ? null : (
            <YStack height={SEPARATOR} marginHorizontal="$md" backgroundColor="$separatorColor" />
          )}
          {row}
        </Fragment>
      ))}
    </YStack>
  )
}

/**
 * A heading over a group, with an optional explanation: the client's `PanelLabelWithDescription`.
 * Use sparingly; over rows whose names already say what they are it is noise.
 */
export function SettingsSection({ label, description }: { label: string; description?: string }) {
  return (
    <YStack gap="$3xs" paddingBottom="$xs" {...logical({ paddingStart: SPACE_SCALE.xs })}>
      <Text size="$body" tone="secondary">
        {label}
      </Text>
      {description === undefined ? null : (
        <Text size="$caption" tone="secondary">
          {description}
        </Text>
      )}
    </YStack>
  )
}
