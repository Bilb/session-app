import type { ComponentType, ReactNode } from 'react'
import { XStack, YStack } from 'tamagui'

import type { MarkProps } from './Brand'
import { Icon } from './Icon'
import type { IconName } from './Icon.types'
import { logical } from './logicalEdges'
import { PressArea } from './PressArea'
import { PRESS_PASSTHROUGH } from './pressPassthrough'
import { Text } from './Text'

/**
 * How tall a row is before its content makes it taller.
 *
 * A control's rung rather than a line of text's: a row is something to hit, and on a phone the
 * difference between a comfortable list and a fiddly one is entirely this number.
 */
const ROW_MIN_HEIGHT = 56

/** How wide the leading icon's column is, so labels line up whether or not a row has one. */
const ICON_COLUMN = 24

/**
 * The line between two rows of a group.
 *
 * A hairline rather than a rung: it is the thinnest thing the display can draw, and the space
 * scale's smallest step is two pixels, which reads as a gap between blocks instead of a division
 * within one.
 */
const SEPARATOR = 1

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
  onPress?: () => void
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
 * A row with no `onPress` still draws. The settings tree arrives one screen per change, so a row
 * whose destination is not built yet belongs on screen and inert rather than hidden -- hiding it
 * would make the list shorter now and change its order later, and the order is the design. **It
 * draws as disabled, not merely as unresponsive**: a row that looks live and does nothing reads as
 * broken rather than as not there yet.
 */
export function SettingsRow({
  label,
  icon,
  subtitle,
  trailing,
  accentIcon = false,
  destructive = false,
  onPress,
  testID,
}: SettingsRowProps) {
  const inert = onPress === undefined
  const tone = inert ? '$textDisabled' : destructive ? '$dangerColor' : '$textPrimary'
  // `accentText` rather than the accent itself: it falls back to the body text on a light ground,
  // where the accent as a glyph is too faint -- which is what the client does with this icon.
  const iconTone = accentIcon && !inert ? '$accentText' : tone

  return (
    <PressArea {...(inert ? {} : { onPress })} disabled={inert} testID={testID}>
      {(pressed) => (
        // The row's surface on a frame of its own, so the states can be laid over it: an overlay
        // steps from whatever it covers, where a surface role would step from the page.
        <YStack backgroundColor="$backgroundSecondary">
          <XStack
            minHeight={ROW_MIN_HEIGHT}
            alignItems="center"
            gap="$sm"
            paddingHorizontal="$md"
            paddingVertical="$xs"
            {...(inert
              ? {}
              : {
                  cursor: 'pointer',
                  hoverStyle: { backgroundColor: '$hoverOverlay' },
                  pressStyle: { backgroundColor: '$pressedOverlay' },
                  // Native: the press belongs to `PressArea`, which reports it here. A frame that
                  // declares a `pressStyle` claims the touch for tamagui otherwise, and the row
                  // never fires. Only here, because it takes the subtree with it: on an inert row
                  // the trailing control is what is pressed.
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
                <Text size="$body" color={inert ? '$textDisabled' : '$textPrimary'}>
                  {subtitle}
                </Text>
              )}
            </YStack>

            {trailing ?? null}
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
 */
export function SettingsGroup({ children }: { children: ReactNode }) {
  return (
    <YStack
      borderRadius="$md"
      overflow="hidden"
      // The group's own surface shows through between rows, which is what draws the separators
      // without a row having to know whether it is the last one.
      backgroundColor="$backgroundPrimary"
      gap={SEPARATOR}
    >
      {children}
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
