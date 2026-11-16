import { memo, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Animated, Platform, StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import Svg, { Circle, Defs, G, Path, RadialGradient, Rect, Stop } from 'react-native-svg'
import { XStack, YStack } from 'tamagui'

import { COLORS, PRIMARY_COLOR_HEX } from '@session/theme-tokens'

import { journeyOf, RING_MS, type Journey } from './pathFlowJourney'
import {
  FLOW_SIDE,
  flowSegment,
  hashUnit,
  layoutPathFlow,
  placeInLayout,
  pathFlowHeight,
  pointAlong,
  type FlowLayout,
} from './pathFlowLayout'
import { Text } from './Text'
import { useReducedMotion } from './useReducedMotion'
import { useTokenColor } from './useTokenColor'

/** What a path leads to, which picks its colour. */
export type PathFlowKind = 'swarm' | 'node' | 'community' | 'file'

export interface PathFlowPath {
  key: string
  kind: PathFlowKind
  /** A country code per column after "you": entry, relay, relay, destination. Null if unknown. */
  countries: readonly (string | null)[]
  /** Drawn bright: a request is moving along it, or it carried the latest one. */
  lit: boolean
  /** A spare held ready for the same destination, carrying only pings: drawn dashed. */
  standby?: boolean | undefined
}

/**
 * A request travelling a path and back. `hopMs` is how long one link takes, which the caller
 * derives from the path's measured round trip so a slow path visibly crawls beside a fast one.
 * A `quiet` one is a ping: smaller and fainter, and it does not stop at the nodes.
 */
export interface PathFlowPacket {
  id: string
  pathKey: string
  startMs: number
  hopMs: number
  quiet?: boolean | undefined
}

export interface PathFlowProps {
  paths: readonly PathFlowPath[]
  packets: readonly PathFlowPacket[]
  /** Rings round each request for the layers of encryption it still carries. */
  onionLayers: boolean
  /** The five column headings: you, entry, relay, relay, destination. */
  columnTitles: readonly [string, string, string, string, string]
  /**
   * A bar's name, from its country code (`?` unknown, `FS` the file server). Where the name does
   * not fit before the next column, the bar is labelled with the code instead.
   */
  labelFor: (country: string) => string
  /** What each colour means, under the drawing; a kind with no path drawn is left out. */
  kindLabels: Readonly<Record<PathFlowKind, string>>
  /** Shown while there is no path yet, over a drawing of one being built. */
  buildingLabel: string
  /**
   * How many paths the caller expects to draw, so the drawing opens at the height those need
   * rather than growing into it as they arrive.
   */
  expectedPaths?: number | undefined
  /**
   * Draws the requests as they are at this moment, still, and under reduced motion too: for the
   * catalog, which cannot capture motion but should show what a request and a ping look like.
   */
  stillAtMs?: number | undefined
  testID?: string | undefined
}

const KIND_COLOR: Record<PathFlowKind, string> = {
  swarm: PRIMARY_COLOR_HEX.green,
  node: PRIMARY_COLOR_HEX.purple,
  community: PRIMARY_COLOR_HEX.orange,
  file: PRIMARY_COLOR_HEX.blue,
}
const KINDS = Object.keys(KIND_COLOR) as PathFlowKind[]

/** SVG units inside the drawing, sized to its bars rather than to the page's type scale. */
const TEXT_PX = 10
const TITLE_Y = 22
/** Line height to font size for the titles and labels. */
const TEXT_LINE_RATIO = 1.2
/** How far below the building line its words sit, to their baseline. */
const BUILDING_LABEL_DROP = 34
/** A bar shorter than this carries no label: there is no room for one beside it. */
const LABEL_MIN_BAR = 6

/** The trail behind a moving request: this many fading copies, this far apart in hops. */
const TRAIL = 4
const TRAIL_STEP = 0.05
/** A ping beside a request: smaller and fainter, yet seen against a line of its own colour. */
const QUIET_OPACITY = 0.55
/** A ping's core, and its rings a pixel smaller and a pixel closer than a request's. */
const QUIET_CORE = 5

export function pathFlowColor(kind: PathFlowKind): string {
  return KIND_COLOR[kind]
}

/** The layers a request to this kind of path leaves with: the file server lies past its last. */
function linksOf(kind: PathFlowKind): number {
  return kind === 'file' ? 3 : 4
}

/** How long a request to this kind of path takes, there and back, pauses included. */
export function pathFlowTripMs(hopMs: number, kind: PathFlowKind, onionLayers: boolean): number {
  return journeyOf(hopMs, linksOf(kind), onionLayers ? 'request' : 'plain').totalMs
}

/**
 * How strongly a line no request is on is drawn: one value for every theme and every number of
 * paths, so a line never changes colour as the drawing fills or a theme loads.
 */
const FAINT_OPACITY = 0.3

/**
 * About how wide a label is drawn: react-native-svg cannot measure text before drawing it, and an
 * estimate on the generous side only means a code where a name would just have fitted.
 */
function textWidth(text: string): number {
  return text.length * 5.8
}

/** The same for a column title, in capitals, which run wider. */
function titleWidth(text: string): number {
  return text.length * 6.6
}

/** The least space between two titles before they are drawn smaller. */
const TITLE_GAP = 8
/** Titles are never drawn smaller than this. */
const MIN_TITLE_PX = 8

/**
 * The size titles are drawn at: the page's, unless the destination's, ending at the right margin,
 * would run into the last relay's, centred over its bar. A narrow phone, or a long translation of
 * "Destination", shrinks them all alike rather than letting the two overlap.
 */
function titlePx(layout: FlowLayout, columnTitles: PathFlowProps['columnTitles']): number {
  const relayMiddle = (layout.columnX[3] ?? 0) + layout.barWidth / 2
  const room = layout.width - FLOW_SIDE - relayMiddle
  const needed = titleWidth(columnTitles[3]) / 2 + TITLE_GAP + titleWidth(columnTitles[4])
  return Math.max(MIN_TITLE_PX, Math.min(TEXT_PX, (TEXT_PX * room) / Math.max(1, needed)))
}

/** Where a title is drawn: your column's from the left margin, the destination's to the right. */
function titlePlace(
  layout: FlowLayout,
  column: number,
): { x: number; textAnchor: 'start' | 'middle' | 'end' } {
  const x = layout.columnX[column] ?? 0
  if (column === 0) return { x, textAnchor: 'start' }
  if (column === layout.columnX.length - 1)
    return { x: layout.width - FLOW_SIDE, textAnchor: 'end' }
  return { x: x + layout.barWidth / 2, textAnchor: 'middle' }
}

function linePath(pts: readonly (readonly [number, number])[], barWidth: number): string {
  const first = pts[0]
  const last = pts[pts.length - 1]
  if (!first || !last) return ''
  // From the right edge of your bar to the left edge of the destination's: neither is crossed.
  let d = `M${first[0] + barWidth},${first[1]}`
  for (let i = 0; i + 1 < pts.length; i += 1) {
    const a = pts[i]
    const b = pts[i + 1]
    if (!a || !b) continue
    const [x0, y0, x1, y1, x2, y2, x3, y3] = flowSegment(a, b, barWidth)
    d += ` L${x0},${y0} C${x1},${y1} ${x2},${y2} ${x3},${y3}`
  }
  return d
}

interface LinesLayerProps {
  layout: FlowLayout
  paths: readonly PathFlowPath[]
}

interface BarsLayerProps {
  layout: FlowLayout
  barColor: string
}

function barLabel(
  layout: FlowLayout,
  country: string,
  count: number,
  labelFor: PathFlowProps['labelFor'],
): string {
  // Between this bar and the one before: the columns are evenly spaced, so the same everywhere.
  const room = (layout.columnX[1] ?? 0) - (layout.columnX[0] ?? 0) - layout.barWidth - 12
  // Every path there ends at the same server, so a count would only crowd its name out.
  const suffix = count > 1 && country !== 'FS' ? ` ${count}` : ''
  const full = `${labelFor(country)}${suffix}`
  return textWidth(full) <= room ? full : `${country}${suffix}`
}

/** Where a native label sits whose SVG baseline would be at `baseline`, at `fontPx`. */
function topFor(baseline: number, fontPx: number): number {
  return baseline - fontPx
}

/** The room either side of a centred title: wider than any, so none is cut. */
const TITLE_HALF_WIDTH = 60
/** A bar label's plate reaches this far past its text on each side. */
const PLATE_PAD = 2
const PLATE_HEIGHT = 13

interface FlowTextProps {
  layout: FlowLayout
  columnTitles: PathFlowProps['columnTitles']
  labelFor: PathFlowProps['labelFor']
  /** Building, with this said beneath the line; otherwise the bars are labelled. */
  buildingLabel: string | null
}

/**
 * The titles and labels, as text over the drawing rather than in it: react-native-svg looks a font
 * up again for every piece of text each time its canvas is drawn, which on an older phone cost
 * more than every line and bar together. Not scaled with the reader's text size, as it is laid out
 * against the bars.
 */
const FlowText = memo(function FlowText({
  layout,
  columnTitles,
  labelFor,
  buildingLabel,
}: FlowTextProps) {
  const titleFontPx = titlePx(layout, columnTitles)
  const buildingY = layout.points.get('building')?.[0]?.[1] ?? 0
  return (
    <YStack position="absolute" top={0} left={0} right={0} bottom={0} pointerEvents="none">
      {columnTitles.map((title, k) => {
        const place = titlePlace(layout, k)
        const box =
          place.textAnchor === 'start'
            ? { left: place.x }
            : place.textAnchor === 'end'
              ? { right: layout.width - place.x }
              : { left: place.x - TITLE_HALF_WIDTH, width: TITLE_HALF_WIDTH * 2 }
        return (
          <Text
            key={title + k}
            position="absolute"
            top={topFor(TITLE_Y, titleFontPx)}
            {...box}
            textAlign={place.textAnchor === 'middle' ? 'center' : 'left'}
            tone="secondary"
            weight="semibold"
            fontSize={titleFontPx}
            lineHeight={Math.round(titleFontPx * TEXT_LINE_RATIO)}
            numberOfLines={1}
            maxFontSizeMultiplier={1}
          >
            {title.toUpperCase()}
          </Text>
        )
      })}
      {buildingLabel === null ? null : (
        <Text
          position="absolute"
          top={topFor(buildingY + BUILDING_LABEL_DROP, TEXT_PX)}
          left={0}
          width={layout.width}
          textAlign="center"
          tone="secondary"
          weight="semibold"
          fontSize={TEXT_PX}
          lineHeight={Math.round(TEXT_PX * TEXT_LINE_RATIO)}
          maxFontSizeMultiplier={1}
        >
          {buildingLabel}
        </Text>
      )}
      {buildingLabel !== null
        ? null
        : layout.bars
            .filter((bar) => bar.column > 0 && bar.height >= LABEL_MIN_BAR)
            .map((bar) => {
              // To the left of its bar: the destination's sits at the right margin, so every label
              // goes on the side where there is room for the destination's.
              const end = (layout.columnX[bar.column] ?? 0) - 5
              const middle = bar.y + bar.height / 2
              return (
                <YStack
                  key={`label-${bar.column}-${bar.country}`}
                  position="absolute"
                  right={layout.width - end}
                  top={middle - PLATE_HEIGHT / 2}
                  height={PLATE_HEIGHT}
                  justifyContent="center"
                >
                  <YStack
                    position="absolute"
                    top={0}
                    bottom={0}
                    left={-PLATE_PAD}
                    right={-PLATE_PAD}
                    backgroundColor="$backgroundSecondary"
                    opacity={0.8}
                  />
                  <Text
                    weight="semibold"
                    opacity={0.85}
                    fontSize={TEXT_PX}
                    lineHeight={PLATE_HEIGHT}
                    numberOfLines={1}
                    maxFontSizeMultiplier={1}
                  >
                    {barLabel(layout, bar.country, bar.count, labelFor)}
                  </Text>
                </YStack>
              )
            })}
    </YStack>
  )
})

/** Every path, faint: redrawn only when the set of paths does. */
const LinesLayer = memo(function LinesLayer({ layout, paths }: LinesLayerProps) {
  const many = paths.length > 6
  return (
    <G>
      {paths.map((p) => {
        const pts = layout.points.get(p.key)
        if (!pts) return null
        return (
          <Path
            key={p.key}
            d={linePath(pts, layout.barWidth)}
            stroke={KIND_COLOR[p.kind]}
            strokeOpacity={FAINT_OPACITY}
            strokeWidth={many ? 1 : 1.5}
            strokeLinecap="round"
            {...(p.standby === true ? { strokeDasharray: '3 4' } : {})}
            fill="none"
          />
        )
      })}
    </G>
  )
})

/** The lit paths, bright over their faint lines: redrawn as requests start and finish. */
const LitLayer = memo(function LitLayer({ layout, paths }: LinesLayerProps) {
  return (
    <G>
      {paths.map((p) => {
        const pts = layout.points.get(p.key)
        if (!pts) return null
        return (
          <Path
            key={p.key}
            d={linePath(pts, layout.barWidth)}
            stroke={KIND_COLOR[p.kind]}
            strokeOpacity={0.95}
            strokeWidth={2.2}
            strokeLinecap="round"
            fill="none"
          />
        )
      })}
    </G>
  )
})

/** The bars, over the lines: redrawn only when the set of paths changes. */
const BarsLayer = memo(function BarsLayer({ layout, barColor }: BarsLayerProps) {
  return (
    <G>
      {layout.bars.map((bar) => (
        <Rect
          key={`${bar.column}-${bar.country}`}
          x={layout.columnX[bar.column] ?? 0}
          y={bar.y - 1}
          width={layout.barWidth}
          height={Math.max(2, bar.height + 2)}
          rx={2.5}
          fill={barColor}
          fillOpacity={0.75}
        />
      ))}
    </G>
  )
})

/**
 * The least time between two redraws of the paths themselves. Every redraw of a hundred paths
 * costs the UI thread a few frames on an older phone, and a busy client opens a session every few
 * seconds; the requests keep moving between redraws.
 */
const PATH_HOLD_MS = 5_000

/** What changes a path's drawn line: not whether it is lit, which is drawn on its own. */
function shapeOf(paths: readonly PathFlowPath[]): string {
  return paths
    .map((p) => `${p.key}|${p.kind}|${p.countries.join(',')}|${p.standby === true ? 1 : 0}`)
    .join(';')
}

/**
 * The paths as last drawn: `paths` once its shape has changed, at most once per `holdMs`. The
 * first paths are drawn at once.
 */
function useHeldPaths(paths: readonly PathFlowPath[], holdMs: number): readonly PathFlowPath[] {
  const shape = shapeOf(paths)
  const [held, setHeld] = useState(() => ({ paths, shape, atMs: Date.now() }))
  const latest = useRef(paths)
  useEffect(() => {
    latest.current = paths
  })
  useEffect(() => {
    if (shape === held.shape) return
    const waitMs = held.paths.length === 0 ? 0 : Math.max(0, held.atMs + holdMs - Date.now())
    const id = setTimeout(() => {
      setHeld({ paths: latest.current, shape: shapeOf(latest.current), atMs: Date.now() })
    }, waitMs)
    return () => clearTimeout(id)
  }, [shape, held, holdMs])
  return holdMs === 0 ? paths : held.paths
}

/**
 * The least time between two layouts of the bars. Laying them out again moves every line, which
 * costs a redraw of each canvas and loses the reader's place, so between layouts a new path joins
 * the bars already drawn and one gone just leaves its slot empty.
 */
const RELAYOUT_MS = 30_000

interface SettledLayout {
  layout: FlowLayout
  keys: string
  widthPx: number
  heightPx: number
  atMs: number
}

function settle(paths: readonly PathFlowPath[], widthPx: number, heightPx: number): SettledLayout {
  return {
    layout: layoutPathFlow(
      paths.map((p) => ({ key: p.key, countries: p.countries })),
      widthPx,
      heightPx,
    ),
    keys: paths.map((p) => p.key).join(';'),
    widthPx,
    heightPx,
    atMs: Date.now(),
  }
}

/**
 * The bars as last laid out, at most once per `relayoutMs` (at once for a new size, or with none
 * drawn yet), and every path placed on them: where that layout put it, or for a path since, a slot
 * in the bars it crosses. A path whose country has no bar in some column waits for the next.
 */
function useSettledLayout(
  paths: readonly PathFlowPath[],
  widthPx: number,
  heightPx: number,
  relayoutMs: number,
): { base: FlowLayout; layout: FlowLayout } {
  const [held, setHeld] = useState(() => settle(paths, widthPx, heightPx))
  const latest = useRef({ paths, widthPx, heightPx })
  useEffect(() => {
    latest.current = { paths, widthPx, heightPx }
  })
  const keys = paths.map((p) => p.key).join(';')
  const resized = held.widthPx !== widthPx || held.heightPx !== heightPx
  useEffect(() => {
    if (keys === held.keys && !resized) return
    const now = Date.now()
    const waitMs =
      resized || relayoutMs === 0 || held.keys === ''
        ? 0
        : Math.max(0, held.atMs + relayoutMs - now)
    const id = setTimeout(() => {
      const { paths: p, widthPx: w, heightPx: h } = latest.current
      setHeld(settle(p, w, h))
    }, waitMs)
    return () => clearTimeout(id)
  }, [keys, held, resized, relayoutMs])
  const layout = useMemo(() => {
    const points = new Map<string, readonly (readonly [number, number])[]>()
    for (const p of paths) {
      const pts = held.layout.points.get(p.key) ?? placeInLayout(held.layout, p)
      if (pts) points.set(p.key, pts)
    }
    return { ...held.layout, points }
  }, [held, paths])
  return { base: held.layout, layout }
}

/** The same array while its contents are: a caller's inline list would redraw a memoised layer. */
function useSameStrings<T extends readonly string[]>(value: T): T {
  const [same, setSame] = useState(value)
  const changed = same.join('\u0000') !== value.join('\u0000')
  if (changed) setSame(value)
  return changed ? value : same
}

/** The radius of a request's `ring`th layer, counting out from its core; a ping's are tighter. */
function layerRadius(ring: number, quiet = false): number {
  return quiet ? 3.5 + (ring - 1) * 1.75 : 4.5 + (ring - 1) * 2.75
}

/** Points sampled along each moving leg: the curve between two columns, as straight runs. */
const LEG_SAMPLES = 5
/** Keyframes may not share a time; one this much later stands for "at once". */
const STEP_MS = 0.01
/** The browser has no native driver: there the same interpolations run in JavaScript. */
const NATIVE_DRIVER = Platform.OS !== 'web'
/** The most layers a request carries at once, and so the rings drawn round it. */
const MOST_LAYERS = 4

interface PacketSpritesProps {
  layout: FlowLayout
  paths: readonly PathFlowPath[]
  packets: readonly PathFlowPacket[]
  onionLayers: boolean
  ringColor: string
  /** Drawn at this moment and never moved on: a still for the catalog. */
  stillAtMs?: number | undefined
}

/** A trip as keyframes: where the request and each copy in its trail are, and its layers. */
interface Keyframes {
  times: number[]
  /** Index 0 the request itself, then each copy in its trail. */
  xs: number[][]
  ys: number[][]
  layers: number[]
}

function keyframesOf(
  journey: Journey,
  pts: readonly (readonly [number, number])[],
  barWidth: number,
  trail: number,
): Keyframes {
  const frames: Keyframes = {
    times: [],
    xs: Array.from({ length: trail + 1 }, () => []),
    ys: Array.from({ length: trail + 1 }, () => []),
    layers: [],
  }
  const push = (atMs: number, h: number, back: boolean, layers: number) => {
    const last = frames.times[frames.times.length - 1]
    frames.times.push(last === undefined ? atMs : Math.max(atMs, last + STEP_MS))
    frames.layers.push(layers)
    for (let j = 0; j <= trail; j += 1) {
      const [x, y] = pointAlong(pts, back ? h + j * TRAIL_STEP : h - j * TRAIL_STEP, barWidth)
      frames.xs[j]?.push(x)
      frames.ys[j]?.push(y)
    }
  }
  let back = false
  for (const leg of journey.legs) {
    if (leg.toHop < leg.fromHop) back = true
    if (leg.toHop === leg.fromHop) {
      push(leg.startMs, leg.fromHop, back, leg.layers)
      if (leg.wrapAtMs !== undefined) {
        push(leg.wrapAtMs, leg.fromHop, back, leg.layers)
        push(leg.wrapAtMs, leg.fromHop, back, leg.layers + 1)
      }
      push(leg.endMs, leg.fromHop, back, leg.layers + (leg.wrapAtMs === undefined ? 0 : 1))
      continue
    }
    for (let i = 0; i <= LEG_SAMPLES; i += 1) {
      const f = i / LEG_SAMPLES
      const h = leg.fromHop + (leg.toHop - leg.fromHop) * f
      push(leg.startMs + (leg.endMs - leg.startMs) * f, h, back, leg.layers)
    }
  }
  return frames
}

/** A circle of radius `r` centred `around` from the top left of its parent. */
function circle(r: number, around = r) {
  return {
    position: 'absolute',
    left: around - r,
    top: around - r,
    width: r * 2,
    height: r * 2,
    borderRadius: r,
  } as const
}

/**
 * A request's glow as plain round views rather than a gradient, which would need a canvas of its
 * own: a faint halo of its path's colour, the colour, and a white heart.
 */
function GlowDot({ kind, r, heart }: { kind: PathFlowKind; r: number; heart: boolean }) {
  const color = KIND_COLOR[kind]
  return (
    <>
      <View style={[circle(r), { backgroundColor: color, opacity: 0.3 }]} />
      <View style={[circle(r * 0.6, r), { backgroundColor: color }]} />
      {heart ? <View style={[circle(r * 0.25, r), { backgroundColor: COLORS.WHITE }]} /> : null}
    </>
  )
}

interface PacketSpriteProps {
  packet: PathFlowPacket
  kind: PathFlowKind
  pts: readonly (readonly [number, number])[]
  barWidth: number
  onionLayers: boolean
  ringColor: string
  stillAtMs: number | undefined
}

function samePoints(
  a: readonly (readonly [number, number])[],
  b: readonly (readonly [number, number])[],
): boolean {
  return a.length === b.length && a.every((p, i) => p[0] === b[i]?.[0] && p[1] === b[i]?.[1])
}

/**
 * One request and its trail, rings and the layers coming off and going on at each node, moved by
 * the native driver from one clock: nothing about it is drawn again or rendered while it travels.
 */
const PacketSprite = memo(
  function PacketSprite({
    packet,
    kind,
    pts,
    barWidth,
    onionLayers,
    ringColor,
    stillAtMs,
  }: PacketSpriteProps) {
    const quiet = packet.quiet === true
    const links = linksOf(kind)
    const journey = useMemo(
      () => journeyOf(packet.hopMs, links, !onionLayers ? 'plain' : quiet ? 'ping' : 'request'),
      [packet.hopMs, links, onionLayers, quiet],
    )
    const trail = quiet ? 2 : TRAIL
    const [clock] = useState(() => new Animated.Value(0))
    useEffect(() => {
      if (stillAtMs !== undefined) {
        clock.setValue(stillAtMs - packet.startMs)
        return
      }
      // Until the last ring has faded too.
      const endMs = journey.totalMs + RING_MS
      const fromMs = Date.now() - packet.startMs
      clock.setValue(fromMs)
      if (fromMs >= endMs) return
      const run = Animated.timing(clock, {
        toValue: endMs,
        duration: endMs - fromMs,
        easing: (t) => t,
        useNativeDriver: NATIVE_DRIVER,
      })
      run.start()
      return () => run.stop()
    }, [clock, journey, packet.startMs, stillAtMs])

    const sprites = useMemo(() => {
      const frames = keyframesOf(journey, pts, barWidth, trail)
      const total = journey.totalMs
      const track = (values: readonly number[], offset: number) =>
        clock.interpolate({
          inputRange: frames.times,
          outputRange: values.map((v) => v - offset),
          extrapolate: 'clamp',
        })
      // The whole request, trail and rings: hidden before it sets off and once it is home.
      const visible = clock.interpolate({
        inputRange: [-STEP_MS, 0, total, total + STEP_MS],
        outputRange: [0, 1, 1, 0],
        extrapolate: 'clamp',
      })
      const dot = (j: number, r: number) => ({
        r,
        opacity: j === 0 ? 1 : 0.5 - j * 0.09,
        transform: [
          { translateX: track(frames.xs[j] ?? [], r) },
          { translateY: track(frames.ys[j] ?? [], r) },
        ],
      })
      const trailDots = Array.from({ length: trail }, (_, i) => {
        const j = trail - i
        return dot(j, (quiet ? 8 - j : 14 - j * 2) / 2)
      })
      const core = dot(0, quiet ? QUIET_CORE : onionLayers ? 10 : 11)
      // Round the request, so they move with it: only whether each shows is animated.
      const layers = !onionLayers
        ? []
        : Array.from({ length: MOST_LAYERS }, (_, k) => ({
            r: layerRadius(k + 1, quiet),
            opacity: clock.interpolate({
              inputRange: frames.times,
              outputRange: frames.layers.map((n) => (n > k ? 0.9 - k * 0.12 : 0)),
              extrapolate: 'clamp',
            }),
          }))
      // A layer coming off swells and fades; one going on closes onto the request; at home every
      // layer comes off at once.
      const bursts =
        !onionLayers || quiet
          ? []
          : journey.rings.map((ring) => {
              const [x, y] = pointAlong(pts, ring.hop, barWidth)
              const base = layerRadius(ring.kind === 'open' ? links : links + 1 - ring.hop)
              const [r0, r1] =
                ring.kind === 'wrap'
                  ? [base + 8, base]
                  : ring.kind === 'open'
                    ? [6, 17]
                    : [base, base + 9]
              const r = Math.max(r0, r1)
              const span = [ring.atMs, ring.atMs + RING_MS]
              return {
                key: `${ring.kind}-${ring.hop}-${ring.atMs}`,
                r,
                opacity: clock.interpolate({
                  inputRange: [ring.atMs - STEP_MS, ...span],
                  outputRange: [0, 0.9, 0],
                  extrapolate: 'clamp',
                }),
                transform: [
                  { translateX: x - r },
                  { translateY: y - r },
                  {
                    scale: clock.interpolate({
                      inputRange: span,
                      outputRange: [r0 / r, r1 / r],
                      extrapolate: 'clamp',
                    }),
                  },
                ],
              }
            })
      return { visible, trailDots, core, layers, bursts }
    }, [clock, journey, pts, barWidth, trail, quiet, onionLayers, links])

    const { core } = sprites
    return (
      <View style={[StyleSheet.absoluteFill, quiet ? QUIET_STYLE : null]} pointerEvents="none">
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: sprites.visible }]}>
          {sprites.trailDots.map((d, i) => (
            <Animated.View
              key={`d${i}`}
              style={[SPRITE, { opacity: d.opacity, transform: d.transform }]}
            >
              <GlowDot kind={kind} r={d.r} heart={false} />
            </Animated.View>
          ))}
          <Animated.View style={[SPRITE, { transform: core.transform }]}>
            <GlowDot kind={kind} r={core.r} heart />
            {sprites.layers.map((l, k) => (
              <Animated.View
                key={`l${k}`}
                style={[circle(l.r, core.r), ringBorder(1, ringColor), { opacity: l.opacity }]}
              />
            ))}
          </Animated.View>
        </Animated.View>
        {sprites.bursts.map((b) => (
          <Animated.View
            key={b.key}
            style={[
              SPRITE,
              circle(b.r),
              ringBorder(2, ringColor),
              { opacity: b.opacity, transform: b.transform },
            ]}
          />
        ))}
      </View>
    )
  },
  (a, b) =>
    a.packet === b.packet &&
    a.kind === b.kind &&
    a.barWidth === b.barWidth &&
    a.onionLayers === b.onionLayers &&
    a.ringColor === b.ringColor &&
    a.stillAtMs === b.stillAtMs &&
    samePoints(a.pts, b.pts),
)

const SPRITE = { position: 'absolute', left: 0, top: 0 } as const
const QUIET_STYLE = { opacity: QUIET_OPACITY } as const

function ringBorder(width: number, color: string) {
  return { borderWidth: width, borderColor: color }
}

/** The requests in flight, over the drawing: moved by the native driver, never redrawn. */
const PacketSprites = memo(function PacketSprites({
  layout,
  paths,
  packets,
  onionLayers,
  ringColor,
  stillAtMs,
}: PacketSpritesProps) {
  const kinds = useMemo(() => new Map(paths.map((p) => [p.key, p.kind])), [paths])
  // Re-rendered with each snapshot, about once a second: a request home since then goes.
  const nowMs = stillAtMs ?? Date.now()
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {packets.map((packet) => {
        const kind = kinds.get(packet.pathKey)
        const pts = layout.points.get(packet.pathKey)
        if (!kind || !pts) return null
        const tripMs = pathFlowTripMs(packet.hopMs, kind, onionLayers && packet.quiet !== true)
        if (stillAtMs === undefined && nowMs - packet.startMs > tripMs + RING_MS) return null
        return (
          <PacketSprite
            key={packet.id}
            packet={packet}
            kind={kind}
            pts={pts}
            barWidth={layout.barWidth}
            onionLayers={onionLayers}
            ringColor={ringColor}
            stillAtMs={stillAtMs}
          />
        )
      })}
    </View>
  )
})

/** One pass of the building drawing: the line reaching the destination, then a pause. */
const BUILD_CYCLE_MS = 2_800
/** The share of a pass spent drawing the line; the rest it stays drawn. */
const BUILD_DRAW_SHARE = 0.75
const BUILD_STEP = 0.05
/** The single path the building drawing is laid out as, so it sits where one path would. */
const BUILDING_PATH = [{ key: 'building', countries: [null, null, null, null] }]

interface BuildingLayerProps {
  layout: FlowLayout
  barColor: string
  glowId: string
  still: boolean
}

/**
 * No path yet: a line being drawn from you to the destination, a column at a time, over and over,
 * with what is happening said beneath it. Still, the line is drawn whole and faint.
 */
function BuildingLayer({ layout, barColor, glowId, still }: BuildingLayerProps) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (still) return
    let frame = 0
    const tick = () => {
      setNow(Date.now())
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [still])
  const pts = layout.points.get('building')
  if (!pts) return null
  const last = pts.length - 1
  const progress = (now % BUILD_CYCLE_MS) / BUILD_CYCLE_MS
  const reach = still ? last : Math.min(1, progress / BUILD_DRAW_SHARE) * last
  const drawn: [number, number][] = []
  for (let h = 0; h < reach; h += BUILD_STEP) drawn.push(pointAlong(pts, h, layout.barWidth))
  drawn.push(pointAlong(pts, reach, layout.barWidth))
  const [hx, hy] = pointAlong(pts, reach, layout.barWidth)
  const y = pts[0]?.[1] ?? 0
  return (
    <G>
      <Path
        d={drawn.map(([x, py], i) => `${i === 0 ? 'M' : 'L'}${x},${py}`).join(' ')}
        stroke={KIND_COLOR.swarm}
        strokeOpacity={still ? 0.4 : 0.7}
        strokeWidth={1.5}
        strokeDasharray="3 4"
        fill="none"
      />
      {pts.map(([x], k) => (
        <Rect
          key={k}
          x={x}
          y={y - layout.barWidth - 1}
          width={layout.barWidth}
          height={layout.barWidth * 2 + 2}
          rx={2.5}
          fill={barColor}
          fillOpacity={reach >= k ? 0.75 : 0.2}
        />
      ))}
      {still ? null : <Circle cx={hx} cy={hy} r={8} fill={`url(#${glowId})`} />}
    </G>
  )
}

/** A dot of each colour drawn, and what it means. */
function Legend({
  paths,
  kindLabels,
}: {
  paths: readonly PathFlowPath[]
  kindLabels: PathFlowProps['kindLabels']
}) {
  const shown = KINDS.filter((kind) => paths.some((p) => p.kind === kind))
  if (shown.length === 0) return null
  return (
    <XStack flexWrap="wrap" columnGap="$sm" rowGap="$2xs" paddingHorizontal="$2xs">
      {shown.map((kind) => (
        <XStack key={kind} alignItems="center" gap="$2xs">
          <YStack
            width="$xxs"
            height="$xxs"
            borderRadius="$full"
            backgroundColor={KIND_COLOR[kind]}
          />
          <Text size="$label" tone="secondary">
            {kindLabels[kind]}
          </Text>
        </XStack>
      ))}
    </XStack>
  )
}

/**
 * The country flow: every drawn path as a line from you through the country of each relay to the
 * destination, with each request travelling its path and back, on a card of its own.
 *
 * Motion stops under the system's reduced-motion setting: the lines and highlights stay, the
 * travelling requests do not.
 */
/**
 * The faint lines' canvases, bottom to top: communities, whose sessions come and go every few
 * seconds, split over two by key; then contacts and groups; then your swarm and the file server,
 * which change least and matter most, drawn over the rest. A path added or dropped redraws only
 * its own canvas, which on an older phone is what a hundred lines on one canvas cost.
 */
function groupLines(paths: readonly PathFlowPath[]): PathFlowPath[][] {
  const groups: PathFlowPath[][] = [[], [], [], []]
  for (const p of paths) {
    const k =
      p.kind === 'community' ? Math.floor(hashUnit(p.key, 2) * 2) : p.kind === 'node' ? 2 : 3
    groups[k]?.push(p)
  }
  return groups
}

/** The moving canvas, laid exactly over the still one. */
const OVERLAY = { position: 'absolute', top: 0, left: 0 } as const

export function PathFlow({
  paths,
  packets,
  onionLayers,
  columnTitles,
  labelFor,
  kindLabels,
  buildingLabel,
  expectedPaths,
  stillAtMs,
  testID,
}: PathFlowProps) {
  const still = useReducedMotion()
  const [widthPx, setWidthPx] = useState(0)
  const barColor = useTokenColor('$textPrimary')
  const ringColor = useTokenColor('$textPrimary')
  // An id per drawing, as a gradient's id is global to the page and two flows could share one.
  const idBase = useId().replace(/[^a-zA-Z0-9]/g, '')
  // A still for the catalog is drawn as given; a live flow redraws its paths only now and then.
  const drawn = useHeldPaths(paths, stillAtMs === undefined ? PATH_HOLD_MS : 0)
  const titles = useSameStrings(columnTitles)
  const building = drawn.length === 0
  // Sized for the most paths drawn since it opened, or expected, so the card grows only when the
  // guess fell short and never shrinks as paths fall idle: the page below it stays where it is.
  // Building takes the room one path would.
  const [mostPaths, setMostPaths] = useState(Math.max(1, drawn.length, expectedPaths ?? 0))
  if (drawn.length > mostPaths) setMostPaths(drawn.length)
  const heightPx = widthPx > 0 ? pathFlowHeight(widthPx, Math.max(mostPaths, drawn.length)) : 0
  const { base, layout: settled } = useSettledLayout(
    drawn,
    widthPx,
    heightPx,
    stillAtMs === undefined ? RELAYOUT_MS : 0,
  )
  const buildingLayout = useMemo(
    () => layoutPathFlow(BUILDING_PATH, widthPx, heightPx),
    [widthPx, heightPx],
  )
  const layout = building ? buildingLayout : settled
  const barsLayout = building ? buildingLayout : base
  const litKeys = paths
    .filter((p) => p.lit)
    .map((p) => p.key)
    .join(';')
  const lit = useMemo(() => {
    const keys = new Set(litKeys.split(';'))
    return drawn.filter((p) => keys.has(p.key))
  }, [drawn, litKeys])
  const glowId = (kind: PathFlowKind) => `pathflow${idBase}${kind}`
  const lineGroups = useMemo(() => groupLines(drawn), [drawn])
  return (
    <YStack alignSelf="stretch" gap="$xs">
      <YStack
        alignSelf="stretch"
        position="relative"
        minHeight={heightPx}
        borderRadius="$lg"
        overflow="hidden"
        backgroundColor="$backgroundSecondary"
        onLayout={(event: LayoutChangeEvent) => setWidthPx(event.nativeEvent.layout.width)}
        testID={testID}
      >
        {widthPx > 0 ? (
          <>
            {/* react-native-svg redraws a whole canvas on the UI thread when any part of it
                changes, so each part sits on a canvas of its own, stacked in drawing order: the
                faint lines and the bars change only with the paths, and the lit lines as requests
                start and finish. The words are text over them, and the requests are views moved
                over everything by the native driver, so nothing is drawn again as they travel. */}
            {lineGroups.map((group, k) => (
              <Svg
                key={k}
                width={widthPx}
                height={heightPx}
                style={k === 0 ? undefined : OVERLAY}
                pointerEvents="none"
              >
                {building ? null : <LinesLayer layout={layout} paths={group} />}
              </Svg>
            ))}
            <Svg width={widthPx} height={heightPx} style={OVERLAY} pointerEvents="none">
              {building ? null : <LitLayer layout={layout} paths={lit} />}
            </Svg>
            <Svg width={widthPx} height={heightPx} style={OVERLAY} pointerEvents="none">
              {building ? null : <BarsLayer layout={barsLayout} barColor={barColor} />}
            </Svg>
            <FlowText
              layout={barsLayout}
              columnTitles={titles}
              labelFor={labelFor}
              buildingLabel={building ? buildingLabel : null}
            />
            {building ? (
              <Svg width={widthPx} height={heightPx} style={OVERLAY} pointerEvents="none">
                <Defs>
                  {/* The building line's leading glow, as a request's. */}
                  <RadialGradient id={glowId('swarm')} cx="50%" cy="50%" r="50%">
                    <Stop offset="0" stopColor={COLORS.WHITE} stopOpacity={1} />
                    <Stop offset="0.18" stopColor={KIND_COLOR.swarm} stopOpacity={1} />
                    <Stop offset="1" stopColor={KIND_COLOR.swarm} stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <BuildingLayer
                  layout={layout}
                  barColor={barColor}
                  glowId={glowId('swarm')}
                  still={still}
                />
              </Svg>
            ) : null}
            {building || (still && stillAtMs === undefined) ? null : (
              <PacketSprites
                layout={layout}
                paths={drawn}
                packets={packets}
                onionLayers={onionLayers}
                ringColor={ringColor}
                stillAtMs={stillAtMs}
              />
            )}
          </>
        ) : null}
      </YStack>
      <Legend paths={paths} kindLabels={kindLabels} />
    </YStack>
  )
}
