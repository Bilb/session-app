import { SPACING } from '@session/theme-tokens'
import { useEffect, useRef } from 'react'
import type { ViewProps } from 'react-native'
import { isWeb, ScrollView, XStack, YStack } from 'tamagui'

import { forwardChevron } from './backChevron'
import { isMenuRow, type ContextMenuEntry, type ContextMenuRow } from './contextMenuEntries'
import { menuKeyAction, type MenuKeyAction } from './contextMenuKeys'
import { Icon } from './Icon'
import { isLayoutRtl } from './layoutDirection'
import { MenuRowPress } from './MenuRowPress'
import { ROW_TOUCH_TARGET } from './rowTouchTarget'
import { SIZE_SCALE } from './scales'
import { raisedShadow } from './shadowColour'
import { Text } from './Text'
import { LABEL_MAX_SCALE, useGlyphScale } from './fontScaleCaps'
import { ROUNDED_SCROLL_ATTRIBUTE } from './roundedScroll'
import { useTokenColor } from './useTokenColor'

/** A pointer's row on the desktop, a finger's on a phone. */
const ROW_MIN_HEIGHT = Math.max(SIZE_SCALE['2xl'], ROW_TOUCH_TARGET)

const ICON_SIZE = SIZE_SCALE.md

/** Wide enough that a short menu does not look like a tooltip. */
const MENU_MIN_WIDTH = 200
/** Past this a label wraps rather than stretching the menu across the window. */
export const MENU_MAX_WIDTH = 280

/** Above and below the rows, inside the border: what a submenu's first row lines up past. */
export const MENU_PADDING_Y = SPACING['2xs']

/** Separators are hairlines between groups, not rows: the keys and a screen reader skip them. */
const SEPARATOR = 1

/**
 * Tags the scrolling element so the global scrollbar rule insets its track by the panel's corners.
 * Web only, and set on the element because the scroll view passes no data attribute through.
 */
function markRoundedScroll(node: unknown): void {
  if (!isWeb || node === null) return
  const scrollable = (node as { getScrollableNode?: () => unknown }).getScrollableNode?.() ?? node
  if (scrollable instanceof HTMLElement) scrollable.setAttribute(ROUNDED_SCROLL_ATTRIBUTE, '')
}

/** What a view's key handlers take, in react-native's types; attached on the web only. */
type KeyHandler = NonNullable<ViewProps['onKeyDown']>

/** The DOM's key event, which is what arrives on the web: react-native's type has no `key`. */
interface DomKeyEvent {
  key: string
  preventDefault: () => void
  stopPropagation: () => void
}

export interface ContextMenuPanelProps {
  entries: readonly ContextMenuEntry[]
  /** Names the menu for a screen reader: what it acts on, or the row that opened it. */
  accessibilityLabel: string
  /** The row the keys or pointer are on, by index in `entries`; -1 for none. */
  active: number
  onActiveChange: (index: number) => void
  /** A row was chosen by pointer, touch or key, or a key asked to open, close or leave. */
  onAction: (action: MenuKeyAction) => void
  /** Which row's submenu is open beside this panel, drawn expanded. */
  openSubmenu: string | null
  /** This is the level the keyboard is in, so it holds focus. Web only. */
  focused: boolean
  /** A submenu, so the key back toward its parent and Escape close only this level. */
  nested: boolean
  /** No tall menu runs off the window: past this the rows scroll. */
  maxHeight?: number | undefined
  /** Each row's element, for placing its submenu beside it. */
  rowRef?: ((id: string, node: unknown) => void) | undefined
  panelRef?: ((node: unknown) => void) | undefined
  testID: string
}

/**
 * One level of a context menu: its rows, separators between them, and the keys that move along
 * them. `ContextMenu` places it and the levels beside it; the catalog draws it on its own.
 */
export function ContextMenuPanel({
  entries,
  accessibilityLabel,
  active,
  onActiveChange,
  onAction,
  openSubmenu,
  focused,
  nested,
  maxHeight,
  rowRef,
  panelRef,
  testID,
}: ContextMenuPanelProps) {
  const shadow = useTokenColor('$shadow')
  const firstRowIndex = entries.findIndex(isMenuRow)
  const nodes = useRef(new Map<number, HTMLElement>())
  const panel = useRef<HTMLElement | null>(null)
  // Focus follows the keys, not the pointer: Chromium rings a scripted focus unless focus last
  // moved by a click, so a hovered row would draw the keyboard's ring.
  const pointerMoved = useRef(false)

  useEffect(() => {
    if (!isWeb || !focused) return
    const target = active === -1 || pointerMoved.current ? panel.current : nodes.current.get(active)
    target?.focus()
  }, [active, focused])

  const onKeyDown: KeyHandler = (raw) => {
    const event = raw as unknown as DomKeyEvent
    const action = menuKeyAction(event.key, {
      entries,
      active,
      nested,
      rtl: isLayoutRtl(),
    })
    if (action === null) return
    event.preventDefault()
    event.stopPropagation()
    pointerMoved.current = false
    if (action.kind === 'move') onActiveChange(action.index)
    else onAction(action)
  }

  return (
    <YStack
      ref={(node: unknown) => {
        panel.current = node as HTMLElement | null
        panelRef?.(node)
      }}
      role="menu"
      aria-label={accessibilityLabel}
      {...(isWeb
        ? {
            tabIndex: -1,
            onKeyDown,
            // Escape's release closes a react-native-web modal from the document; the menu has
            // already acted on the press, and one level at a time.
            onKeyUp: ((raw) => {
              const event = raw as unknown as DomKeyEvent
              if (event.key === 'Escape') event.stopPropagation()
            }) satisfies KeyHandler,
            outlineStyle: 'none',
          }
        : {})}
      minWidth={MENU_MIN_WIDTH}
      maxWidth={MENU_MAX_WIDTH}
      {...(maxHeight === undefined ? {} : { maxHeight })}
      // The card surface, as a settings row's: the danger ink is 4.3:1 on it in Classic Light and
      // 3.9:1 on the tertiary one. The border carries the edge where the card is flat on the base.
      backgroundColor="$backgroundSecondary"
      borderWidth={1}
      borderColor="$bordersColor"
      borderRadius="$md"
      overflow="hidden"
      boxShadow={`0px 4px 12px 0px ${raisedShadow(shadow)}`}
      testID={testID}
    >
      <ScrollView
        ref={markRoundedScroll}
        bounces={false}
        contentContainerStyle={{ paddingVertical: MENU_PADDING_Y }}
      >
        {entries.map((entry, index) =>
          isMenuRow(entry) ? (
            <MenuRowPress
              key={entry.id}
              active={index === active}
              tabStop={index === (active === -1 ? firstRowIndex : active)}
              disabled={entry.disabled === true}
              expanded={entry.kind === 'submenu' ? openSubmenu === entry.id : undefined}
              onActivate={() => {
                onActiveChange(index)
                onAction(
                  entry.kind === 'submenu'
                    ? { kind: 'openSubmenu', index }
                    : { kind: 'activate', index },
                )
              }}
              onHover={() => {
                pointerMoved.current = true
                onActiveChange(index)
              }}
              nodeRef={(node) => {
                if (node === null) nodes.current.delete(index)
                else nodes.current.set(index, node as HTMLElement)
                rowRef?.(entry.id, node)
              }}
              testID={entry.testID}
            >
              {(highlighted) => <MenuRowContent entry={entry} highlighted={highlighted} />}
            </MenuRowPress>
          ) : (
            <YStack
              key={entry.id}
              role="separator"
              height={SEPARATOR}
              marginVertical="$2xs"
              backgroundColor="$separatorColor"
            />
          ),
        )}
      </ScrollView>
    </YStack>
  )
}

function MenuRowContent({ entry, highlighted }: { entry: ContextMenuRow; highlighted: boolean }) {
  const glyphScale = useGlyphScale()
  const disabled = entry.disabled === true
  const tone = disabled
    ? '$textDisabled'
    : entry.kind === 'action' && entry.destructive === true
      ? '$dangerColor'
      : '$textPrimary'
  const glyph = Math.round(ICON_SIZE * glyphScale)
  return (
    <XStack
      minHeight={ROW_MIN_HEIGHT}
      alignItems="center"
      gap="$sm"
      paddingHorizontal="$sm"
      paddingVertical="$2xs"
      {...(highlighted && !disabled ? { backgroundColor: '$hoverOverlay' } : {})}
      {...(disabled ? {} : { '$platform-web': { cursor: 'pointer' } })}
    >
      {entry.icon === undefined ? null : <Icon name={entry.icon} size={glyph} color={tone} />}
      <Text flex={1} size="$body" color={tone} maxFontSizeMultiplier={LABEL_MAX_SCALE}>
        {entry.label}
      </Text>
      {entry.kind === 'submenu' ? <Icon name={forwardChevron()} size={glyph} color={tone} /> : null}
    </XStack>
  )
}
