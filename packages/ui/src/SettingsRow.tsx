import { Children, Fragment, type ComponentType, type ReactNode } from 'react'
import { XStack, YStack } from 'tamagui'

import type { MarkProps } from './Brand'
import { Icon } from './Icon'
import type { IconName } from './Icon.types'
import { logical } from './logicalEdges'
import { PressArea } from './PressArea'
import { PRESS_PASSTHROUGH } from './pressPassthrough'
import { Text } from './Text'
import { offScaleText } from './textHeight'

/**
 * How tall a row is before its content makes it taller.
 *
 * A control's rung rather than a line of text's: a row is something to hit, and on a phone the
 * difference between a comfortable list and a fiddly one is entirely this number.
 */
const ROW_MIN_HEIGHT = 56

/**
 * A subtitle's size: the desktop client's 13, which falls between the ramp's 12 and 14.
 *
 * Off the ramp on purpose. At 14 a subtitle is the size of body text under a 16 label, and the two
 * lines stop reading as a name and its explanation.
 */
const SUBTITLE_SIZE = 13

/** How wide the leading icon's column is, so labels line up whether or not a row has one. */
const ICON_COLUMN = 24

/**
 * The line between two rows of a group: the desktop client's half pixel.
 *
 * Half rather than one because a whole pixel lands on one device pixel or two depending on where
 * the row falls, so the lines of one group drew at different weights; half is one device pixel on
 * every display that has two, and the thinnest line on one that does not.
 */
const SEPARATOR = 0.5

export interface SettingsRowProps {
  label: string
  /**
   * The leading glyph. Rows in one group either all have one or none do.
   *
   * A name from the icon set, or one of Session's own marks for the rows the client draws with its
   * own artwork -- the recovery shield, the network token.
   */
  icon?: IconName | ComponentType<MarkProps>
  /** Draws the icon in the accent, for the row the client singles out that way: Donate. */
  accentIcon?: boolean
  /** A second line under the label, for a row whose meaning is not obvious from its name. */
  subtitle?: string
  /**
   * The trailing side: a current value, a switch, a button.
   *
   * Nothing by default, and in particular no chevron: the client's rows carry none, whether or not
   * they lead to a screen.
   */
  trailing?: ReactNode
  /** Tints the label and its icon, for a row that destroys something. */
  destructive?: boolean
  /**
   * Without one the row is static: drawn as it is, with nothing to press but its trailing control.
   */
  onPress?: () => void
  /** For a row whose screen is not built yet. See the component. */
  disabled?: boolean
  testID: string
}

/**
 * One row of a settings list.
 *
 * The desktop client's `PanelButton`: a glyph, a label, and whatever belongs on the other side.
 * **Nothing here knows what it is for** -- a row that navigates, a row that toggles and a row that
 * deletes an account are the same component with different trailing content, which is what keeps a
 * list of twelve of them reading as one list.
 *
 * A row whose screen is not built yet still draws, `disabled`. The settings tree arrives one screen
 * per change, so such a row belongs on screen rather than hidden -- hiding it would make the list
 * shorter now and change its order later, and the order is the design. **It draws as disabled, not
 * merely as unresponsive**: a row that looks live and does nothing reads as broken rather than as
 * not there yet. Said rather than inferred from a missing `onPress`, because a row with nothing to
 * press but its trailing control is not unavailable.
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
  // `accentText` rather than the accent itself: it falls back to the body text on a light ground,
  // where the accent as a glyph is too faint -- which is what the client does with this icon.
  const iconTone = accentIcon && !disabled ? '$accentText' : tone

  return (
    <PressArea
      {...(onPress === undefined || disabled ? {} : { onPress })}
      disabled={inert}
      testID={testID}
    >
      {(pressed) => (
        // The row's surface on a frame of its own, so the states can be laid over it: an overlay
        // steps from whatever it covers, where a surface role would step from the page.
        <YStack backgroundColor="$backgroundSecondary">
          <XStack
            minHeight={ROW_MIN_HEIGHT}
            alignItems="center"
            gap="$sm"
            // The client's 20 either side, which the separators are inset by too, so a line
            // starts where a row's content does.
            paddingHorizontal="$lg"
            paddingVertical="$xs"
            {...(inert
              ? {}
              : {
                  cursor: 'pointer',
                  hoverStyle: { backgroundColor: '$hoverOverlay' },
                  pressStyle: { backgroundColor: '$pressedOverlay' },
                  // Native: the press belongs to `PressArea`, which reports it here. A frame that
                  // declares a `pressStyle` claims the touch for tamagui otherwise, and the row
                  // never fires. Only here, because it takes the subtree with it: on a row with no
                  // press of its own the trailing control is what is pressed.
                  ...PRESS_PASSTHROUGH,
                  ...(pressed ? { backgroundColor: '$pressedOverlay' } : {}),
                })}
          >
            {icon === undefined ? null : (
              <YStack width={ICON_COLUMN} alignItems="center">
                {typeof icon === 'string' ? (
                  <Icon name={icon} size="lg" color={iconTone} />
                ) : (
                  // A mark fills its box where a lucide glyph sits inside a margin, so it is drawn
                  // a rung smaller to read at the same weight as its neighbours.
                  <Mark mark={icon} color={iconTone} />
                )}
              </YStack>
            )}

            <YStack flex={1} gap="$3xs">
              <Text size="$bodyLarge" weight="bold" color={tone}>
                {label}
              </Text>
              {subtitle === undefined ? null : (
                // The label's colour, not the muted one: the desktop client draws a row's
                // explanation in the body text, and it is read rather than glanced at.
                <Text
                  {...offScaleText(SUBTITLE_SIZE)}
                  color={disabled ? '$textDisabled' : '$textPrimary'}
                >
                  {subtitle}
                </Text>
              )}
            </YStack>

            {trailing === undefined ? null : (
              // More room than between the icon and the label: the label is the icon's, and the
              // trailing control is something else -- text that wraps into it reads as run on.
              <YStack {...logical({ paddingStart: '$xs', paddingEnd: '$2xs' })}>{trailing}</YStack>
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
 * A run of rows drawn as one block.
 *
 * The client's `PanelButtonGroup`. The grouping is the only thing saying which rows belong
 * together -- the root settings page has four groups and no headings at all, so the gaps between
 * blocks carry the whole structure.
 *
 * The separators are drawn here, between rows, so a row never has to know whether it is last. Inset
 * from both edges and running under the icons, as the client's do: a divider the full width of the
 * card reads as two cards.
 */
export function SettingsGroup({ children }: { children: ReactNode }) {
  const rows = Children.toArray(children)
  return (
    <YStack borderRadius="$md" overflow="hidden" backgroundColor="$backgroundSecondary">
      {rows.map((row, at) => (
        <Fragment key={at}>
          {at === 0 ? null : (
            <YStack height={SEPARATOR} marginHorizontal="$lg" backgroundColor="$separatorColor" />
          )}
          {row}
        </Fragment>
      ))}
    </YStack>
  )
}

/**
 * A heading over a group, with an optional explanation under it.
 *
 * The client's `PanelLabelWithDescription`, and used as sparingly: the root settings page has no
 * headings, and Help has one per group. A heading over a group of rows whose names already say
 * what they are is noise.
 */
export function SettingsSection({ label, description }: { label: string; description?: string }) {
  return (
    <YStack gap="$3xs" paddingBottom="$xs" {...logical({ paddingStart: '$xs' })}>
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
