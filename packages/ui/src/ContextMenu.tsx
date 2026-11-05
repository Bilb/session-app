import { SPACING } from '@session/theme-tokens'
import { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Modal, Platform } from 'react-native'
import { isWeb, YStack } from 'tamagui'

import { measureAnchor, type AnchorRect } from './anchorRect'
import { backChevron } from './backChevron'
import {
  entriesAt,
  isMenuRow,
  tidyMenu,
  type ContextMenuEntry,
  type ContextMenuRow,
} from './contextMenuEntries'
import type { MenuKeyAction } from './contextMenuKeys'
import {
  leadingInset,
  placeMenu,
  placeSubmenu,
  type MenuAnchor,
  type MenuGeometry,
  type PanelSpot,
  type Size,
} from './contextMenuPlacement'
import { ContextMenuPanel, MENU_MAX_WIDTH, MENU_PADDING_Y } from './ContextMenuPanel'
import { InteractionOverride } from './interactionOverride'
import { isLayoutRtl } from './layoutDirection'
import { logical } from './logicalEdges'
import { useWindowSize } from './useWindowSize'

export type { ContextMenuEntry, ContextMenuRow, MenuAnchor }

/** Kept clear between the menu and the window's edge. */
const MARGIN = SPACING.xs
/** Between an element and a menu opened against it. */
const GAP = SPACING['2xs']
/** How far a submenu laps over its parent, so the two read as one menu. */
const OVERLAP = SPACING['2xs']
/** A pointer resting on a submenu row this long opens it; passing over on the way down does not. */
const HOVER_OPEN_MS = 250

const BACK_ID = 'context-menu-back'

/** Each menu level's test id. Passed in, since every id comes from `@session/test-ids`. */
export interface ContextMenuTestIDs {
  /** The first level, and the one panel when submenus open in place. */
  menu: string
  /** A submenu beside its parent. */
  submenu: string
  /** The row that leaves a submenu opened in place. */
  back: string
}

interface ContextMenuShared {
  entries: readonly ContextMenuEntry[]
  onDismiss: () => void
  /** Names the menu for a screen reader: what it acts on. */
  accessibilityLabel: string
  /** The row that leaves a submenu opened in place of its parent. */
  backLabel: string
  testIDs: ContextMenuTestIDs
}

interface Placed extends PanelSpot, Size {}

interface Level {
  /** Which submenus lead here; the spot is remembered under it. */
  key: string
  entries: readonly ContextMenuEntry[]
  label: string
  nested: boolean
  testID: string
}

export interface ContextMenuLayerProps extends ContextMenuShared {
  /** In the layer's own coordinates. */
  anchor: MenuAnchor
  bounds: Size
  /** Submenus open on arrival: for the catalog, which has no pointer to open them with. */
  initialPath?: readonly string[] | undefined
  /** Submenus open in place of their parent rather than beside it. Forced on native. */
  inPlace?: boolean | undefined
  /** Moves keyboard focus into the menu. Off in the catalog, which draws many at once. */
  takesFocus?: boolean | undefined
  /** Called with a chosen row's action; the caller closes the menu before running it. */
  onSelect: (entry: ContextMenuRow) => void
}

/**
 * `measureAnchor`, synchronous on the web. Tamagui gives a DOM node a `measureInWindow` that
 * answers through an IntersectionObserver, after the browser has painted; the rectangle itself is
 * there to read at once, so a panel is placed before anyone sees it unplaced.
 */
function measureNow(node: unknown, onMeasured: (rect: AnchorRect | null) => void): void {
  const element = node as { getBoundingClientRect?: () => DOMRect } | null
  if (isWeb && typeof element?.getBoundingClientRect === 'function') {
    measureAnchor({ getBoundingClientRect: () => element.getBoundingClientRect!() }, onMeasured)
    return
  }
  measureAnchor(node, onMeasured)
}

function firstRow(entries: readonly ContextMenuEntry[]): number {
  return entries.findIndex(isMenuRow)
}

/** A drilled-in level's entries: the way back, then the submenu's own. */
function withBack(entries: readonly ContextMenuEntry[], label: string, testID: string) {
  const back: ContextMenuEntry = {
    id: BACK_ID,
    kind: 'action',
    label,
    icon: backChevron(),
    testID,
    onSelect: () => {},
  }
  return [back, { id: `${BACK_ID}-separator`, kind: 'separator' }, ...entries] as const
}

/**
 * The menu's levels, laid out inside a box of `bounds`: the window in `ContextMenu`, a fixed
 * cell in the catalog.
 *
 * **Every panel is measured before it is shown**, so it can be placed whole: drawn once unseen at
 * the corner, measured, then moved. On the web the measurement answers inside the layout effect,
 * before the browser paints, so nothing is ever drawn in the wrong place; on native it costs a
 * frame with the panel invisible.
 *
 * **Submenus open beside their parent on the desktop and in its place on a phone.** Beside is what
 * a pointer expects. On a phone there is rarely room for two panels side by side, and Android
 * delivers no touch to a view drawn outside its parent's bounds, so a submenu replaces its parent
 * with a row back at the top.
 */
export function ContextMenuLayer({
  anchor,
  bounds,
  entries: given,
  onDismiss,
  onSelect,
  accessibilityLabel,
  backLabel,
  testIDs,
  initialPath = [],
  inPlace: inPlaceAsked = false,
  takesFocus = true,
}: ContextMenuLayerProps) {
  const root = tidyMenu(given)
  const inPlace = inPlaceAsked || !isWeb || bounds.width < 2 * MENU_MAX_WIDTH + 2 * MARGIN
  const [path, setPath] = useState<readonly string[]>(initialPath)
  // Opened by the keyboard, the first row is focused, as WAI-ARIA asks; by a pointer, none is.
  const [actives, setActives] = useState<readonly number[]>(() => [
    anchor.kind === 'element' ? firstRow(root) : -1,
    ...initialPath.map(() => -1),
  ])
  const [spots, setSpots] = useState<Readonly<Record<string, Placed>>>({})
  const forced = useContext(InteractionOverride)
  const layer = useRef<unknown>(null)
  const panels = useRef(new Map<string, unknown>())
  const rows = useRef(new Map<string, unknown>())
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(hoverTimer.current), [])

  const rtl = isLayoutRtl()
  const geometry: MenuGeometry = { bounds, margin: MARGIN, rtl }

  const levels: Level[] = []
  if (inPlace) {
    const deepest = tidyMenu(entriesAt(root, path))
    const opener = path.length === 0 ? undefined : rowAt(root, path)
    levels.push({
      key: `in-place/${path.join('/')}`,
      entries: path.length === 0 ? deepest : withBack(deepest, backLabel, testIDs.back),
      label: opener?.label ?? accessibilityLabel,
      nested: path.length > 0,
      testID: testIDs.menu,
    })
  } else {
    levels.push({
      key: '',
      entries: root,
      label: accessibilityLabel,
      nested: false,
      testID: testIDs.menu,
    })
    path.forEach((_, depth) => {
      const leading = path.slice(0, depth + 1)
      levels.push({
        key: leading.join('/'),
        entries: tidyMenu(entriesAt(root, leading)),
        label: rowAt(root, leading)?.label ?? accessibilityLabel,
        nested: true,
        testID: testIDs.submenu,
      })
    })
  }

  // Placed again from scratch when the box changes size or the menu opens somewhere else.
  const placementKey = `${String(bounds.width)}x${String(bounds.height)}:${JSON.stringify(anchor)}`
  const [placedFor, setPlacedFor] = useState(placementKey)
  if (placedFor !== placementKey) {
    setPlacedFor(placementKey)
    setSpots({})
  }

  useLayoutEffect(() => {
    levels.forEach((level, depth) => {
      if (spots[level.key] !== undefined) return
      const parent = depth === 0 ? undefined : spots[levels[depth - 1]!.key]
      if (depth > 0 && parent === undefined) return
      measureNow(layer.current, (origin) => {
        measureNow(panels.current.get(level.key), (rect) => {
          if (origin === null || rect === null) return
          const size = { width: rect.width, height: rect.height }
          if (parent === undefined) {
            const spot = placeMenu(anchor, size, geometry, GAP)
            setSpots((placed) => ({ ...placed, [level.key]: { ...spot, ...size } }))
            return
          }
          measureNow(rows.current.get(path[depth - 1]!), (row) => {
            if (row === null) return
            const inLayer: AnchorRect = { ...row, x: row.x - origin.x, y: row.y - origin.y }
            const spot = placeSubmenu(inLayer, parent, size, geometry, OVERLAP, MENU_PADDING_Y)
            setSpots((placed) => ({ ...placed, [level.key]: { ...spot, ...size } }))
          })
        })
      })
    })
  })

  const setActive = (depth: number, index: number) => {
    setActives((current) => {
      const next = current.slice(0, depth + 1)
      while (next.length <= depth) next.push(-1)
      next[depth] = index
      return next
    })
  }

  const openSubmenu = (depth: number, index: number, focusFirst: boolean) => {
    const entry = levels[depth]!.entries[index]
    if (entry?.kind !== 'submenu' || entry.disabled === true) return
    const leading = inPlace ? path : path.slice(0, depth)
    const opened = [...leading, entry.id]
    setPath(opened)
    const sub = tidyMenu(entriesAt(root, opened))
    // Only the web has a focus to move; on a phone a highlighted first row would read as pressed.
    const into = focusFirst && isWeb ? (inPlace ? 0 : firstRow(sub)) : -1
    setActives((current) => (inPlace ? [into] : [...current.slice(0, depth), index, into]))
  }

  const closeLevel = () => {
    if (path.length === 0) {
      onDismiss()
      return
    }
    const closed = path.slice(0, -1)
    const left = path[path.length - 1]
    setPath(closed)
    const parentEntries = inPlace
      ? closed.length === 0
        ? root
        : withBack(tidyMenu(entriesAt(root, closed)), '', '')
      : levels[closed.length]!.entries
    const back = isWeb ? parentEntries.findIndex((entry) => entry.id === left) : -1
    setActives((current) => (inPlace ? [back] : [...current.slice(0, closed.length), back]))
  }

  const onAction = (depth: number, action: MenuKeyAction) => {
    clearTimeout(hoverTimer.current)
    switch (action.kind) {
      case 'move':
        setActive(depth, action.index)
        return
      case 'openSubmenu':
        openSubmenu(depth, action.index, true)
        return
      case 'closeLevel':
        closeLevel()
        return
      case 'dismiss':
        onDismiss()
        return
      case 'activate': {
        const entry = levels[depth]!.entries[action.index]
        if (entry === undefined || !isMenuRow(entry) || entry.disabled === true) return
        if (entry.id === BACK_ID) closeLevel()
        else onSelect(entry)
      }
    }
  }

  const onHover = (depth: number, index: number) => {
    setActive(depth, index)
    clearTimeout(hoverTimer.current)
    if (inPlace) return
    const entry = levels[depth]!.entries[index]
    const opensHere = entry?.kind === 'submenu' && entry.disabled !== true
    const open = path[depth]
    if (opensHere && open === entry.id) return
    // Resting on another row of this level closes what it had open, as passing over does not.
    if (!opensHere && open === undefined) return
    hoverTimer.current = setTimeout(() => {
      if (opensHere) openSubmenu(depth, index, false)
      else {
        setPath(path.slice(0, depth))
        setActives((current) => current.slice(0, depth + 1))
      }
    }, HOVER_OPEN_MS)
  }

  const deepest = levels.length - 1
  const forcing = forced !== null && (forced.hovered || forced.focused || forced.pressed)

  return (
    <YStack
      ref={(node: unknown) => {
        layer.current = node
      }}
      // The panels' containing block, laid at the corner of whatever holds it.
      position="relative"
      width={bounds.width}
      height={bounds.height}
      pointerEvents="box-none"
    >
      {levels.map((level, depth) => {
        const spot = spots[level.key]
        const active = actives[depth] ?? -1
        return (
          <YStack
            key={level.key}
            position="absolute"
            top={spot?.y ?? 0}
            {...(spot === undefined ? { opacity: 0 } : {})}
            {...logical({
              insetStart: spot === undefined ? 0 : leadingInset(spot.x, spot.width, geometry),
            })}
            // Swallows the press, so a tap inside the menu does not reach the backdrop.
            onPress={(event) => {
              event.stopPropagation()
            }}
          >
            <ContextMenuPanel
              entries={level.entries}
              accessibilityLabel={level.label}
              active={
                active === -1 && forcing && depth === deepest ? firstRow(level.entries) : active
              }
              onActiveChange={(index) => {
                onHover(depth, index)
              }}
              onAction={(action) => {
                onAction(depth, action)
              }}
              openSubmenu={inPlace ? null : (path[depth] ?? null)}
              focused={takesFocus && depth === deepest && spot !== undefined}
              nested={level.nested}
              maxHeight={spot?.maxHeight}
              rowRef={(id, node) => {
                if (node === null) rows.current.delete(id)
                else rows.current.set(id, node)
              }}
              panelRef={(node) => {
                if (node === null) panels.current.delete(level.key)
                else panels.current.set(level.key, node)
              }}
              testID={level.testID}
            />
          </YStack>
        )
      })}
    </YStack>
  )
}

function rowAt(root: readonly ContextMenuEntry[], path: readonly string[]) {
  const parent = entriesAt(root, path.slice(0, -1))
  const row = parent.find((entry) => entry.id === path[path.length - 1])
  return row !== undefined && isMenuRow(row) ? row : undefined
}

export interface ContextMenuProps extends ContextMenuShared {
  /** Where it opens, in window coordinates; null while closed. */
  anchor: MenuAnchor | null
}

/**
 * A menu of actions on something, opened where the person asked for it: at the pointer on a
 * right-click, at the finger on a long press, against an element from the keyboard.
 *
 * Drawn by the app on every platform rather than by Electron or the OS, so it looks the same
 * everywhere and the catalog can capture it. Controlled: the caller holds the anchor and clears it
 * in `onDismiss`. A chosen row's `onSelect` runs once the menu has gone, so whatever it opens is
 * not stacked under the menu: iOS presents one modal per parent at a time.
 *
 * Focus returns on close to the element that had it when the menu opened, so the keyboard user
 * who opened it from a message is back on that message.
 */
export function ContextMenu({ anchor, onDismiss, ...shared }: ContextMenuProps) {
  const window = useWindowSize()
  const pending = useRef<(() => void) | null>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const open = anchor !== null

  // A layout effect, so it runs before the panel's own effect moves focus into the menu.
  useLayoutEffect(() => {
    if (!open || !isWeb) return
    returnFocus.current = document.activeElement as HTMLElement | null
    return () => {
      const target = returnFocus.current
      returnFocus.current = null
      if (target !== null && document.contains(target)) target.focus()
    }
  }, [open])

  const runPending = () => {
    const action = pending.current
    pending.current = null
    action?.()
  }

  // iOS says when the modal has gone in `onDismiss`; everywhere else it has once it is closed.
  useEffect(() => {
    if (!open && Platform.OS !== 'ios') runPending()
  }, [open])

  return (
    <Modal
      visible={open}
      transparent
      onRequestClose={onDismiss}
      onDismiss={runPending}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <YStack
        flex={1}
        onPress={onDismiss}
        {...(isWeb
          ? {
              onContextMenu: (event: { preventDefault: () => void }) => {
                event.preventDefault()
                onDismiss()
              },
            }
          : {})}
      >
        {anchor === null ? null : (
          <ContextMenuLayer
            {...shared}
            anchor={anchor}
            bounds={window}
            onDismiss={onDismiss}
            onSelect={(entry) => {
              if (entry.kind !== 'action') return
              pending.current = entry.onSelect
              onDismiss()
            }}
          />
        )}
      </YStack>
    </Modal>
  )
}
