import type { AccessibleNode, AuditIssue } from './ISessionApp'
import { walk, type NativeNode } from './nativeTree'

/** The smallest target Android's and Apple's guidelines allow, in dp and pt. */
const MIN_TARGET = { android: 48, ios: 44 } as const

/** react-native's Android role classes, from `AccessibilityRole`, folded onto the shared roles. */
const ANDROID_ROLES: Readonly<Record<string, AccessibleNode['role']>> = {
  'android.widget.Button': 'button',
  'android.widget.ImageButton': 'button',
  'android.widget.ImageView': 'image',
  'android.widget.TextView': 'text',
  'android.widget.EditText': 'textbox',
  'android.widget.ProgressBar': 'progressbar',
  'android.widget.SeekBar': 'progressbar',
}

const IOS_ROLES: Readonly<Record<string, AccessibleNode['role']>> = {
  XCUIElementTypeButton: 'button',
  XCUIElementTypeImage: 'image',
  XCUIElementTypeStaticText: 'text',
  XCUIElementTypeLink: 'link',
  XCUIElementTypeTextField: 'textbox',
  XCUIElementTypeSecureTextField: 'textbox',
  XCUIElementTypeTextView: 'textbox',
  XCUIElementTypeSearchField: 'textbox',
  XCUIElementTypeProgressIndicator: 'progressbar',
}

/** What react-native appends to a busy element's content description and value, in English. */
const BUSY = 'busy'

const orNull = (value: string | undefined): string | null =>
  value === undefined || value === '' || value === 'null' ? null : value

interface Box {
  x: number
  y: number
  width: number
  height: number
}

/** `[left,top][right,bottom]`, in pixels. */
function androidBounds(node: NativeNode): Box {
  const [left = 0, top = 0, right = 0, bottom = 0] = (
    /\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]/.exec(node.attributes['bounds'] ?? '') ?? []
  )
    .slice(1)
    .map(Number)
  return { x: left, y: top, width: right - left, height: bottom - top }
}

function iosRect(node: NativeNode): Box {
  const number = (name: string) => Number(node.attributes[name] ?? '0')
  return { x: number('x'), y: number('y'), width: number('width'), height: number('height') }
}

/** A node's box in dp or pt, which is what a layout is written in; `density` is Android's dpi. */
export function nativeFrame(node: NativeNode, platform: 'android' | 'ios', density: number): Box {
  if (platform === 'ios') return iosRect(node)
  const { x, y, width, height } = androidBounds(node)
  const dp = (px: number) => (px * 160) / density
  return { x: dp(x), y: dp(y), width: dp(width), height: dp(height) }
}

const inside = (inner: Box, outer: Box) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height

/** Splits react-native's busy suffix off an Android content description. */
function androidLabel(description: string | null): { name: string | null; busy: boolean } {
  if (description === null) return { name: null, busy: false }
  if (description === BUSY) return { name: null, busy: true }
  if (description.endsWith(`, ${BUSY}`))
    return { name: description.slice(0, -`, ${BUSY}`.length), busy: true }
  return { name: description, busy: false }
}

const androidFocusable = (node: NativeNode) =>
  node.attributes['focusable'] === 'true' || node.attributes['screen-reader-focusable'] === 'true'

/** What TalkBack reads for a stop with no label of its own: the text inside it, stops excluded. */
function androidInnerText(node: NativeNode): string | null {
  const parts: string[] = []
  const visit = (parent: NativeNode) => {
    for (const child of parent.children) {
      if (androidFocusable(child)) continue
      const own = orNull(child.attributes['content-desc']) ?? orNull(child.attributes['text'])
      if (own !== null) parts.push(own)
      else visit(child)
    }
  }
  visit(node)
  return parts.length === 0 ? null : parts.join(' ')
}

/**
 * Whether TalkBack can reach the node at all: `aria-hidden` is react-native's
 * no-hide-descendants, which UiAutomator2 still lists, as unimportant.
 */
export const androidHidden = (node: NativeNode) => node.attributes['a11y-important'] === 'false'

/** A UiAutomator2 node as assistive technology reads it; `density` is the screen's dpi. */
export function androidAccessibleNode(node: NativeNode, density: number): AccessibleNode {
  const { name: described, busy } = androidLabel(orNull(node.attributes['content-desc']))
  const focusable = androidFocusable(node)
  const name =
    described ?? orNull(node.attributes['text']) ?? (focusable ? androidInnerText(node) : null)
  const { width, height } = androidBounds(node)
  const dp = (px: number) => Math.round((px * 160) / density)
  const roled = ANDROID_ROLES[node.attributes['class'] ?? '']
  // A container that only carries a label and takes nothing is read as text, as a TextView is.
  const labelOnly = described !== null && !focusable && node.attributes['clickable'] !== 'true'
  return {
    role: roled ?? (labelOnly ? 'text' : 'none'),
    name,
    // react-native puts accessibilityHint in the tooltip, which is what TalkBack reads after.
    hint: orNull(node.attributes['tooltip-text']) ?? orNull(node.attributes['hint']),
    disabled: node.attributes['enabled'] === 'false',
    busy,
    focusable,
    bounds: { width: dp(width), height: dp(height) },
  }
}

/**
 * A node's custom accessibility actions on Android, which UiAutomator2 lists unnamed; react-native
 * maps `activate` to the standard click, so it is not among them.
 */
export const androidCustomActions = (node: NativeNode): null[] =>
  (node.attributes['actions'] ?? '')
    .split(',')
    .filter((action) => action === 'ACTION_UNKNOWN')
    .map(() => null)

/** The value components react-native joins with ", " on iOS, the busy state among them. */
const iosValueParts = (value: string | null) => (value === null ? [] : value.split(', '))

/**
 * An XCUITest element as VoiceOver reads it. XCUITest has no hint, so it comes from `hint`, which
 * the caller reads elsewhere.
 */
export function iosAccessibleNode(node: NativeNode, hint: string | null): AccessibleNode {
  const { width, height } = iosRect(node)
  const name = orNull(node.attributes['label'])
  const focusable = node.attributes['accessible'] === 'true'
  const roled = IOS_ROLES[node.tag] ?? IOS_ROLES[node.attributes['type'] ?? '']
  return {
    // As on Android: a plain view that carries a label and is no element of its own is text.
    role: roled ?? (name !== null && !focusable ? 'text' : 'none'),
    name,
    hint,
    disabled: node.attributes['enabled'] === 'false',
    busy: iosValueParts(orNull(node.attributes['value'])).includes(BUSY),
    focusable,
    bounds: { width, height },
  }
}

/** The test id a node carries: Android's resource id, iOS's identifier. */
export function testIdOf(node: NativeNode, platform: 'android' | 'ios'): string | null {
  if (platform === 'android') return orNull(node.attributes['resource-id'])
  // XCUITest's `name` is the identifier, or the label where there is none.
  const name = orNull(node.attributes['name'])
  return name !== null && name !== orNull(node.attributes['label']) ? name : null
}

/** The nearest test id at or above `node`, which is what a finding is named by. */
function nearestTestId(node: NativeNode, platform: 'android' | 'ios'): string | null {
  for (let at: NativeNode | null = node; at !== null; at = at.parent) {
    const id = testIdOf(at, platform)
    if (id !== null) return id
  }
  return null
}

const describeNode = (node: NativeNode) =>
  `${node.tag} ${JSON.stringify(node.attributes['resource-id'] ?? node.attributes['name'] ?? '')}`

/** iOS's scrolled views, which carry no `scrollable` attribute as Android's do. */
const IOS_SCROLLED = new Set([
  'XCUIElementTypeScrollView',
  'XCUIElementTypeTable',
  'XCUIElementTypeCollectionView',
])

/**
 * Whether the visible box was cut by a scrolled ancestor. Android reports the box as cut, iOS the
 * whole frame, so on both a box reaching the scrolled view's edge counts as cut.
 */
function clippedByScroll(node: NativeNode, platform: 'android' | 'ios'): boolean {
  const box = platform === 'android' ? androidBounds : iosRect
  const own = box(node)
  for (let at = node.parent; at !== null; at = at.parent) {
    const scrolled =
      platform === 'android'
        ? at.attributes['scrollable'] === 'true'
        : IOS_SCROLLED.has(at.attributes['type'] ?? at.tag)
    if (!scrolled) continue
    const frame = box(at)
    return own.y <= frame.y || own.y + own.height >= frame.y + frame.height
  }
  return false
}

/** Whether all of the node is on screen, inside whatever scrolled view holds it. */
export const shownWhole = (node: NativeNode, platform: 'android' | 'ios') =>
  !clippedByScroll(node, platform)

/** Whether `inner` is drawn within `outer`'s box: Android's tree need not nest the two. */
export function liesWithin(inner: NativeNode, outer: NativeNode, platform: 'android' | 'ios') {
  const box = platform === 'android' ? androidBounds : iosRect
  return inside(box(inner), box(outer))
}

/**
 * The rules Android gets in place of a platform audit, over the TalkBack stops in the window:
 *
 * - a stop has something to say, its own label or the text inside it;
 * - a stop that takes a press is at least 48dp each way, unless a scrolled list cut it;
 * - no stop sits inside another, which TalkBack reads twice or never.
 */
export function androidAudit(root: NativeNode, density: number, within?: NativeNode): AuditIssue[] {
  const issues: AuditIssue[] = []
  const stops = [...walk(root)].filter(
    (node) =>
      androidFocusable(node) &&
      // A scrolled list is focusable for the keyboard; TalkBack moves through what it holds.
      node.attributes['scrollable'] !== 'true' &&
      !androidHidden(node) &&
      node.attributes['displayed'] !== 'false',
  )
  const box = within === undefined ? null : androidBounds(within)
  for (const node of stops) {
    if (box !== null && !inside(androidBounds(node), box)) continue
    const target = nearestTestId(node, 'android') ?? describeNode(node)
    const described = androidAccessibleNode(node, density)
    if (described.name === null)
      issues.push({ rule: 'name', impact: 'critical', target, message: 'a stop that says nothing' })
    const { width, height } = described.bounds
    const pressable = node.attributes['clickable'] === 'true' && !described.disabled
    if (
      pressable &&
      (width < MIN_TARGET.android || height < MIN_TARGET.android) &&
      !clippedByScroll(node, 'android')
    )
      issues.push({
        rule: 'target-size',
        impact: 'serious',
        target,
        message: `${String(width)}x${String(height)}dp, under ${String(MIN_TARGET.android)}dp`,
      })
    for (let at = node.parent; at !== null; at = at.parent)
      if (stops.includes(at)) {
        issues.push({
          rule: 'nested-stop',
          impact: 'serious',
          target,
          message: `a stop inside ${nearestTestId(at, 'android') ?? describeNode(at)}`,
        })
        break
      }
  }
  return issues
}

/** Apple's audit does not size targets against the guideline, so this does, for iOS. */
export function iosTargetSizes(root: NativeNode, within?: NativeNode): AuditIssue[] {
  const box = within === undefined ? null : iosRect(within)
  return [...walk(root)]
    .filter(
      (node) =>
        (box === null || inside(iosRect(node), box)) &&
        node.tag === 'XCUIElementTypeButton' &&
        node.attributes['enabled'] !== 'false' &&
        node.attributes['visible'] === 'true',
    )
    .flatMap((node) => {
      const { width, height } = iosRect(node)
      if (width >= MIN_TARGET.ios && height >= MIN_TARGET.ios) return []
      return [
        {
          rule: 'target-size',
          impact: 'serious',
          target: nearestTestId(node, 'ios') ?? describeNode(node),
          message: `${String(width)}x${String(height)}pt, under ${String(MIN_TARGET.ios)}pt`,
        } as const,
      ]
    })
}
