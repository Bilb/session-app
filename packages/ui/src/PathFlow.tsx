import { memo, useEffect, useMemo, useState } from 'react'
import type { LayoutChangeEvent } from 'react-native'
import Svg, { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg'
import { YStack } from 'tamagui'

import { PRIMARY_COLOR_HEX } from '@session/theme-tokens'

import { flowSegment, layoutPathFlow, pointAlong, type FlowLayout } from './pathFlowLayout'
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
}

/**
 * A request travelling a path and back: out across the four links, a pause at the far end, then
 * back the same way. `hopMs` is how long one link takes, which the caller derives from the path's
 * measured round trip so a slow path visibly crawls beside a fast one.
 */
export interface PathFlowPacket {
  id: string
  pathKey: string
  startMs: number
  hopMs: number
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
  heightPx?: number | undefined
  testID?: string | undefined
}

const KIND_COLOR: Record<PathFlowKind, string> = {
  swarm: PRIMARY_COLOR_HEX.green,
  node: PRIMARY_COLOR_HEX.purple,
  community: PRIMARY_COLOR_HEX.orange,
  file: PRIMARY_COLOR_HEX.blue,
}

const LINKS = 4
/** SVG units inside the drawing, sized to its bars rather than to the page's type scale. */
const TITLE_PX = 11
const LABEL_PX = 10
/** The far end reading the request and wrapping its answer, before the answer sets off back. */
const HOLD_MS = 220

/** Where a request is, `h` hops out, and how many layers it carries; null once it is home. */
export function packetState(
  packet: PathFlowPacket,
  nowMs: number,
): { h: number; layers: number } | null {
  const t = nowMs - packet.startMs
  const out = LINKS * packet.hopMs
  if (t < 0) return null
  if (t < out) {
    const h = t / packet.hopMs
    return { h, layers: LINKS - Math.floor(h) }
  }
  if (t < out + HOLD_MS) return { h: LINKS, layers: t < out + HOLD_MS / 2 ? 0 : 1 }
  const back = t - out - HOLD_MS
  if (back >= out) return null
  const h = LINKS - back / packet.hopMs
  return { h, layers: LINKS + 1 - Math.ceil(Math.max(h, 0.0001)) }
}

export function pathFlowColor(kind: PathFlowKind): string {
  return KIND_COLOR[kind]
}

/**
 * About how wide a label is drawn: react-native-svg cannot measure text before drawing it, and an
 * estimate on the generous side only means a code where a name would just have fitted.
 */
function textWidth(text: string): number {
  return text.length * 6.2
}

function segmentsPath(pts: readonly (readonly [number, number])[], barWidth: number): string {
  const first = pts[0]
  if (!first) return ''
  let d = `M${first[0]},${first[1]}`
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
  return (
    <G>
      {columnTitles.map((title, k) => (
        <SvgText
          key={title + k}
          x={(layout.columnX[k] ?? 0) + layout.barWidth / 2}
          y={14}
          fill={titleColor}
          fontSize={TITLE_PX}
          fontWeight="600"
          textAnchor={k === 0 ? 'start' : 'middle'}
        >
          {title.toUpperCase()}
        </SvgText>
      ))}
      {paths.map((p) => {
        const pts = layout.points.get(p.key)
        if (!pts) return null
        return (
          <Path
            key={p.key}
            d={segmentsPath(pts, layout.barWidth)}
            stroke={KIND_COLOR[p.kind]}
            strokeOpacity={p.lit ? 0.95 : many ? 0.22 : 0.4}
            strokeWidth={p.lit ? 2.2 : many ? 1 : 1.5}
            strokeLinecap="round"
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
        .filter((bar) => bar.column > 0 && bar.height >= 10)
        .map((bar) => {
          const x = (layout.columnX[bar.column] ?? 0) + layout.barWidth + 5
          const next = layout.columnX[bar.column + 1]
          const room = (next ?? layout.width) - x - 6
          const count = bar.count > 1 ? ` ${bar.count}` : ''
          const full = `${labelFor(bar.country)}${count}`
          const text = textWidth(full) <= room ? full : `${bar.country}${count}`
          const y = bar.y + bar.height / 2
          return (
            <G key={`label-${bar.column}-${bar.country}`}>
              <Rect
                x={x - 2}
                y={y - 7}
                width={textWidth(text) + 4}
                height={13}
                fill={plateColor}
                fillOpacity={0.8}
              />
              <SvgText x={x} y={y + 3.5} fill={labelColor} fontSize={LABEL_PX} fontWeight="600">
                {text}
              </SvgText>
            </G>
          )
        })}
    </G>
  )
})

interface PacketLayerProps {
  layout: FlowLayout
  paths: readonly PathFlowPath[]
  packets: readonly PathFlowPacket[]
  onionLayers: boolean
  ringColor: string
}

/** The requests in flight, redrawn every frame while there are any. */
function PacketLayer({ layout, paths, packets, onionLayers, ringColor }: PacketLayerProps) {
  const [now, setNow] = useState(() => Date.now())
  const live = packets.some((p) => packetState(p, now) !== null || p.startMs > now)
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

  const kinds = useMemo(() => new Map(paths.map((p) => [p.key, p.kind])), [paths])
  return (
    <G>
      {packets.map((packet) => {
        const state = packetState(packet, now)
        const pts = layout.points.get(packet.pathKey)
        const kind = kinds.get(packet.pathKey)
        if (!state || !pts || !kind) return null
        const [x, y] = pointAlong(pts, state.h, layout.barWidth)
        const color = KIND_COLOR[kind]
        return (
          <G key={packet.id}>
            {onionLayers
              ? Array.from({ length: state.layers }, (_, i) => (
                  <Circle
                    key={i}
                    cx={x}
                    cy={y}
                    r={6 + (i + 1) * 3}
                    stroke={ringColor}
                    strokeOpacity={0.75 - i * 0.12}
                    strokeWidth={1.2}
                    fill="none"
                  />
                ))
              : null}
            <Circle cx={x} cy={y} r={5} fill={color} />
            <Circle cx={x} cy={y} r={2} fill={ringColor} />
          </G>
        )
      })}
    </G>
  )
}

/**
 * The country flow: every drawn path as a line from you through the country of each relay to the
 * destination, with each request travelling its path and back.
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
  heightPx = 380,
  testID,
}: PathFlowProps) {
  const still = useReducedMotion()
  const [widthPx, setWidthPx] = useState(0)
  const barColor = useTokenColor('$textPrimary')
  const labelColor = useTokenColor('$textPrimary')
  const titleColor = useTokenColor('$textSecondary')
  const plateColor = useTokenColor('$backgroundSecondary')
  const layout = useMemo(
    () =>
      layoutPathFlow(
        paths.map((p) => ({ key: p.key, countries: p.countries })),
        widthPx,
        heightPx,
      ),
    [paths, widthPx, heightPx],
  )
  return (
    <YStack
      alignSelf="stretch"
      height={heightPx}
      onLayout={(event: LayoutChangeEvent) => setWidthPx(event.nativeEvent.layout.width)}
      testID={testID}
    >
      {widthPx > 0 ? (
        <Svg width={widthPx} height={heightPx}>
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
          {still ? null : (
            <PacketLayer
              layout={layout}
              paths={paths}
              packets={packets}
              onionLayers={onionLayers}
              ringColor={labelColor}
            />
          )}
        </Svg>
      ) : null}
    </YStack>
  )
}
