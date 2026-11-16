import { memo, useEffect, useId, useMemo, useState } from 'react'
import { Platform, type LayoutChangeEvent } from 'react-native'
import Svg, {
  Circle,
  Defs,
  G,
  Path,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg'
import { XStack, YStack } from 'tamagui'

import { COLORS, PRIMARY_COLOR_HEX } from '@session/theme-tokens'

import { BODY_FACE } from './bodyFace'
import { BODY_FONT_FAMILY } from './config'
import { FACE_WEIGHTS } from './faceWeights'
import { journeyAt, journeyOf, RING_MS, ringsAt, type Journey } from './pathFlowJourney'
import {
  FLOW_SIDE,
  flowSegment,
  layoutPathFlow,
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
/** No font token reaches SVG text: the web needs the family named, native draws the system's. */
const SVG_FONT = {
  ...(Platform.OS === 'web' ? { fontFamily: BODY_FONT_FAMILY } : {}),
  fontSize: TEXT_PX,
  fontWeight: FACE_WEIGHTS[BODY_FACE].semibold,
}
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

interface StaticLayerProps {
  layout: FlowLayout
  paths: readonly PathFlowPath[]
  columnTitles: PathFlowProps['columnTitles']
  labelFor: PathFlowProps['labelFor']
  barColor: string
  labelColor: string
  titleColor: string
  plateColor: string
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

function Titles({
  layout,
  columnTitles,
  color,
}: {
  layout: FlowLayout
  columnTitles: PathFlowProps['columnTitles']
  color: string
}) {
  return (
    <G>
      {columnTitles.map((title, k) => {
        const place = titlePlace(layout, k)
        const fontSize = titlePx(layout, columnTitles)
        return (
          <SvgText
            key={title + k}
            x={place.x}
            textAnchor={place.textAnchor}
            y={TITLE_Y}
            fill={color}
            {...SVG_FONT}
            fontSize={fontSize}
          >
            {title.toUpperCase()}
          </SvgText>
        )
      })}
    </G>
  )
}

/** Bars, labels and lines: redrawn only when the paths change, never per frame. */
const StaticLayer = memo(function StaticLayer({
  layout,
  paths,
  columnTitles,
  labelFor,
  barColor,
  labelColor,
  titleColor,
  plateColor,
}: StaticLayerProps) {
  const many = paths.length > 6
  // Bright lines over faint ones, wherever they sit in the list.
  const ordered = [...paths].sort((a, b) => Number(a.lit) - Number(b.lit))
  return (
    <G>
      <Titles layout={layout} columnTitles={columnTitles} color={titleColor} />
      {ordered.map((p) => {
        const pts = layout.points.get(p.key)
        if (!pts) return null
        return (
          <Path
            key={p.key}
            d={linePath(pts, layout.barWidth)}
            stroke={KIND_COLOR[p.kind]}
            strokeOpacity={p.lit ? 0.95 : FAINT_OPACITY}
            strokeWidth={p.lit ? 2.2 : many ? 1 : 1.5}
            strokeLinecap="round"
            {...(p.standby === true && !p.lit ? { strokeDasharray: '3 4' } : {})}
            fill="none"
          />
        )
      })}
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
      {layout.bars
        .filter((bar) => bar.column > 0 && bar.height >= LABEL_MIN_BAR)
        .map((bar) => {
          // To the left of its bar: the destination's sits at the right margin, so every label goes
          // on the side where there is room for the destination's.
          const x = (layout.columnX[bar.column] ?? 0) - 5
          const text = barLabel(layout, bar.country, bar.count, labelFor)
          const y = bar.y + bar.height / 2
          return (
            <G key={`label-${bar.column}-${bar.country}`}>
              <Rect
                x={x - textWidth(text) - 2}
                y={y - 7}
                width={textWidth(text) + 4}
                height={13}
                fill={plateColor}
                fillOpacity={0.8}
              />
              <SvgText
                x={x}
                y={y + 3.5}
                textAnchor="end"
                fill={labelColor}
                fillOpacity={0.85}
                {...SVG_FONT}
              >
                {text}
              </SvgText>
            </G>
          )
        })}
    </G>
  )
})

/** The radius of a request's `ring`th layer, counting out from its core; a ping's are tighter. */
function layerRadius(ring: number, quiet = false): number {
  return quiet ? 3.5 + (ring - 1) * 1.75 : 4.5 + (ring - 1) * 2.75
}

interface PacketLayerProps {
  /** Drawn at this moment and never moved on: a still for the catalog. */
  stillAtMs?: number | undefined
  layout: FlowLayout
  paths: readonly PathFlowPath[]
  packets: readonly PathFlowPacket[]
  onionLayers: boolean
  ringColor: string
  glowId: (kind: PathFlowKind) => string
}

interface Flight {
  packet: PathFlowPacket
  kind: PathFlowKind
  links: number
  journey: Journey
}

/** The requests in flight, redrawn every frame while there are any. */
function PacketLayer({
  layout,
  paths,
  packets,
  onionLayers,
  ringColor,
  glowId,
  stillAtMs,
}: PacketLayerProps) {
  const [ticked, setNow] = useState(() => Date.now())
  const now = stillAtMs ?? ticked
  const flights = useMemo(() => {
    const kinds = new Map(paths.map((p) => [p.key, p.kind]))
    const list: Flight[] = []
    for (const packet of packets) {
      const kind = kinds.get(packet.pathKey)
      if (!kind) continue
      const links = linksOf(kind)
      const style = !onionLayers ? 'plain' : packet.quiet === true ? 'ping' : 'request'
      list.push({ packet, kind, links, journey: journeyOf(packet.hopMs, links, style) })
    }
    return list
  }, [paths, packets, onionLayers])
  // Until the last ring has faded too: stopping with the request leaves the ring drawn.
  const live =
    stillAtMs === undefined &&
    flights.some((f) => now < f.packet.startMs + f.journey.totalMs + RING_MS)
  useEffect(() => {
    if (!live) return
    let frame = 0
    const tick = () => {
      setNow(Date.now())
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [live])

  return (
    <G>
      {flights.map(({ packet, kind, journey }) => {
        const state = journeyAt(journey, now - packet.startMs)
        const pts = layout.points.get(packet.pathKey)
        if (!state || !pts) return null
        const quiet = packet.quiet === true
        const at = (h: number) => pointAlong(pts, h, layout.barWidth)
        const [x, y] = at(state.h)
        const fill = `url(#${glowId(kind)})`
        const trail = quiet ? 2 : TRAIL
        return (
          <G key={packet.id} opacity={quiet ? QUIET_OPACITY : 1}>
            {Array.from({ length: trail }, (_, i) => {
              const j = trail - i
              const [tx, ty] = at(state.back ? state.h + j * TRAIL_STEP : state.h - j * TRAIL_STEP)
              return (
                <Circle
                  key={`t${j}`}
                  cx={tx}
                  cy={ty}
                  r={(quiet ? 8 - j : 14 - j * 2) / 2}
                  fill={fill}
                  opacity={0.5 - j * 0.09}
                />
              )
            })}
            <Circle cx={x} cy={y} r={quiet ? QUIET_CORE : onionLayers ? 10 : 11} fill={fill} />
            {!onionLayers
              ? null
              : Array.from({ length: state.layers }, (_, k) => (
                  <Circle
                    key={`l${k}`}
                    cx={x}
                    cy={y}
                    r={layerRadius(k + 1, quiet)}
                    stroke={ringColor}
                    strokeOpacity={0.9 - k * 0.12}
                    strokeWidth={1}
                    fill="none"
                  />
                ))}
          </G>
        )
      })}
      {onionLayers
        ? flights.flatMap(({ packet, links, journey }) => {
            const pts = layout.points.get(packet.pathKey)
            if (!pts || packet.quiet === true) return []
            return ringsAt(journey, now - packet.startMs).map(({ ring, age }) => {
              const [x, y] = pointAlong(pts, ring.hop, layout.barWidth)
              const base = layerRadius(ring.kind === 'open' ? links : links + 1 - ring.hop)
              // A layer coming off swells and fades; one going on closes onto the request; at
              // home every layer comes off at once.
              const r =
                ring.kind === 'wrap'
                  ? base + (1 - age) * 8
                  : ring.kind === 'open'
                    ? 6 + age * 11
                    : base + age * 9
              return (
                <Circle
                  key={`${packet.id}-${ring.kind}-${ring.hop}-${ring.atMs}`}
                  cx={x}
                  cy={y}
                  r={r}
                  stroke={ringColor}
                  strokeOpacity={(1 - age) * 0.9}
                  strokeWidth={2}
                  fill="none"
                />
              )
            })
          })
        : null}
    </G>
  )
}

/** One pass of the building drawing: the line reaching the destination, then a pause. */
const BUILD_CYCLE_MS = 2_800
/** The share of a pass spent drawing the line; the rest it stays drawn. */
const BUILD_DRAW_SHARE = 0.75
const BUILD_STEP = 0.05
/** The single path the building drawing is laid out as, so it sits where one path would. */
const BUILDING_PATH = [{ key: 'building', countries: [null, null, null, null] }]

interface BuildingLayerProps {
  layout: FlowLayout
  columnTitles: PathFlowProps['columnTitles']
  label: string
  barColor: string
  titleColor: string
  glowId: string
  still: boolean
}

/**
 * No path yet: a line being drawn from you to the destination, a column at a time, over and over,
 * with what is happening said beneath it. Still, the line is drawn whole and faint.
 */
function BuildingLayer({
  layout,
  columnTitles,
  label,
  barColor,
  titleColor,
  glowId,
  still,
}: BuildingLayerProps) {
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
      <Titles layout={layout} columnTitles={columnTitles} color={titleColor} />
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
      <SvgText x={layout.width / 2} y={y + 34} textAnchor="middle" fill={titleColor} {...SVG_FONT}>
        {label}
      </SvgText>
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
export function PathFlow({
  paths,
  packets,
  onionLayers,
  columnTitles,
  labelFor,
  kindLabels,
  buildingLabel,
  stillAtMs,
  testID,
}: PathFlowProps) {
  const still = useReducedMotion()
  const [widthPx, setWidthPx] = useState(0)
  const barColor = useTokenColor('$textPrimary')
  const labelColor = useTokenColor('$textPrimary')
  const titleColor = useTokenColor('$textSecondary')
  const plateColor = useTokenColor('$backgroundSecondary')
  // An id per drawing, as a gradient's id is global to the page and two flows could share one.
  const idBase = useId().replace(/[^a-zA-Z0-9]/g, '')
  const building = paths.length === 0
  // Sized for the most paths drawn since it opened, so the card grows when it must and never
  // shrinks as paths fall idle: the page below it stays where it is. Building takes the room one
  // path would.
  const [mostPaths, setMostPaths] = useState(Math.max(1, paths.length))
  if (paths.length > mostPaths) setMostPaths(paths.length)
  const heightPx = widthPx > 0 ? pathFlowHeight(widthPx, Math.max(mostPaths, paths.length)) : 0
  const layout = useMemo(
    () =>
      layoutPathFlow(
        building ? BUILDING_PATH : paths.map((p) => ({ key: p.key, countries: p.countries })),
        widthPx,
        heightPx,
      ),
    [building, paths, widthPx, heightPx],
  )
  const glowId = (kind: PathFlowKind) => `pathflow${idBase}${kind}`
  return (
    <YStack alignSelf="stretch" gap="$xs">
      <YStack
        alignSelf="stretch"
        minHeight={heightPx}
        borderRadius="$lg"
        overflow="hidden"
        backgroundColor="$backgroundSecondary"
        onLayout={(event: LayoutChangeEvent) => setWidthPx(event.nativeEvent.layout.width)}
        testID={testID}
      >
        {widthPx > 0 ? (
          <Svg width={widthPx} height={heightPx}>
            <Defs>
              {KINDS.map((kind) => (
                // A request's glow: white at its heart, its path's colour, then nothing.
                <RadialGradient key={kind} id={glowId(kind)} cx="50%" cy="50%" r="50%">
                  <Stop offset="0" stopColor={COLORS.WHITE} stopOpacity={1} />
                  <Stop offset="0.18" stopColor={KIND_COLOR[kind]} stopOpacity={1} />
                  <Stop offset="1" stopColor={KIND_COLOR[kind]} stopOpacity={0} />
                </RadialGradient>
              ))}
            </Defs>
            {building ? (
              <BuildingLayer
                layout={layout}
                columnTitles={columnTitles}
                label={buildingLabel}
                barColor={barColor}
                titleColor={titleColor}
                glowId={glowId('swarm')}
                still={still}
              />
            ) : null}
            {building ? null : (
              <StaticLayer
                layout={layout}
                paths={paths}
                columnTitles={columnTitles}
                labelFor={labelFor}
                barColor={barColor}
                labelColor={labelColor}
                titleColor={titleColor}
                plateColor={plateColor}
              />
            )}
            {building || (still && stillAtMs === undefined) ? null : (
              <PacketLayer
                layout={layout}
                paths={paths}
                packets={packets}
                onionLayers={onionLayers}
                ringColor={labelColor}
                glowId={glowId}
                stillAtMs={stillAtMs}
              />
            )}
          </Svg>
        ) : null}
      </YStack>
      <Legend paths={paths} kindLabels={kindLabels} />
    </YStack>
  )
}
