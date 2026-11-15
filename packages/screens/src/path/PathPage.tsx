import { URLS } from '@session/app'
import { PENDING_COPY, tr } from '@session/localization'
import { useSessionActions } from '@session/state'
import { ELEMENT } from '@session/test-ids'
import {
  Icon,
  PathFlow,
  SettingsGroup,
  SettingsRow,
  Text,
  useModals,
  XStack,
  YStack,
  type PathFlowPacket,
  type PathFlowPath,
} from '@session/ui'
import { useEffect, useMemo, useRef, useState } from 'react'

import {
  EMPTY_TRACKER,
  hopMsFor,
  inUse,
  pathStats,
  trackSnapshot,
  type PathStats,
  type PathTracker,
} from './pathActivity'
import { confirmLink } from '../settings/confirmLink'

/**
 * The legacy clients' "Learn More". libsession's URL table has the FAQ but not this anchor in it.
 * TODO: take it from URLS once libsession's link list carries the onion-routing anchor.
 */
const LEARN_MORE_URL = `${URLS.faq}/#onion-routing`

/** How often the screen asks for a fresh snapshot while it is showing. */
const POLL_MS = 1_000

type Highlight = 'latest' | 'busy'

/** A country's name in the app's language where the platform knows it, else its code. */
function makeLabeller(): (country: string) => string {
  let names: Intl.DisplayNames | null = null
  try {
    names = new Intl.DisplayNames(undefined, { type: 'region' })
  } catch {
    names = null
  }
  return (country) => {
    if (country === '?') return tr('onionRoutingPathUnknownCountry')
    if (country === 'FS') return 'File server'
    const name = names?.of(country)
    // A long name crowds the next column: the code says the same in less room.
    return name !== undefined && name.length <= 14 ? name : country
  }
}

function ms(value: number | null): string {
  return value === null
    ? '-'
    : PENDING_COPY.onionRoutingPathMilliseconds.replace('{ms}', String(Math.round(value)))
}

function Stat({ label, value, name }: { label: string; value: string; name: string }) {
  return (
    <YStack flexBasis="45%" flexGrow={1} gap="$3xs" testID={ELEMENT.settings.pathStat(name)}>
      <Text size="$label" tone="secondary">
        {label}
      </Text>
      <Text size="$heading">{value}</Text>
    </YStack>
  )
}

function StatsCard({ stats }: { stats: PathStats }) {
  return (
    <XStack
      flexWrap="wrap"
      rowGap="$md"
      columnGap="$md"
      padding="$md"
      borderRadius="$md"
      backgroundColor="$backgroundSecondary"
    >
      <Stat
        name="in-use"
        label={PENDING_COPY.onionRoutingPathsInUse}
        value={String(stats.pathsInUse)}
      />
      <Stat
        name="countries"
        label={PENDING_COPY.onionRoutingPathCountries}
        value={String(stats.countriesCrossed)}
      />
      <Stat
        name="entry"
        label={PENDING_COPY.onionRoutingPathEntryNodes}
        value={String(stats.entryNodes)}
      />
      <Stat
        name="rebuilt"
        label={PENDING_COPY.onionRoutingPathRebuilt}
        value={String(stats.rebuilt)}
      />
      <Stat
        name="average"
        label={PENDING_COPY.onionRoutingPathAverage}
        value={ms(stats.averageMs)}
      />
      <Stat
        name="fastest"
        label={PENDING_COPY.onionRoutingPathFastest}
        value={ms(stats.fastestMs)}
      />
      <Stat
        name="slowest"
        label={PENDING_COPY.onionRoutingPathSlowest}
        value={ms(stats.slowestMs)}
      />
      <Stat name="jitter" label={PENDING_COPY.onionRoutingPathJitter} value={ms(stats.jitterMs)} />
    </XStack>
  )
}

/**
 * Every path the client is using, drawn as a country flow: from you through the country of each
 * relay to the destination, with each request travelling its path and back at a speed taken from
 * that path's measured round trip. A child screen; the settings modal supplies the chrome.
 *
 * Polls libsession once a second while open, and not at all otherwise.
 */
export function PathPage() {
  const actions = useSessionActions()
  const modals = useModals()
  const [tracker, setTracker] = useState<PathTracker>(EMPTY_TRACKER)
  const [packets, setPackets] = useState<PathFlowPacket[]>([])
  const [latestKey, setLatestKey] = useState<string | null>(null)
  const [highlight, setHighlight] = useState<Highlight>('busy')
  const [nowMs, setNowMs] = useState(() => Date.now())
  const trackerRef = useRef(tracker)
  const labelFor = useMemo(makeLabeller, [])

  useEffect(() => {
    let live = true
    const poll = async () => {
      const snapshot = await actions.getNetworkPaths().catch(() => null)
      if (!live || snapshot === null) return
      const now = Date.now()
      const { tracker: next, requests } = trackSnapshot(trackerRef.current, snapshot, now, POLL_MS)
      trackerRef.current = next
      setTracker(next)
      setNowMs(now)
      if (requests.length > 0) {
        const latency = new Map(next.paths.map((p) => [p.key, p.latencyMs]))
        setLatestKey(requests[requests.length - 1]?.pathKey ?? null)
        setPackets((was) => [
          // Anything that set off over half a minute ago is home by now.
          ...was.filter((p) => now - p.startMs < 30_000),
          ...requests.map((r) => ({
            id: r.id,
            pathKey: r.pathKey,
            startMs: r.atMs,
            hopMs: hopMsFor(latency.get(r.pathKey) ?? 0),
          })),
        ])
      }
    }
    void poll()
    const timer = setInterval(() => void poll(), POLL_MS)
    return () => {
      live = false
      clearInterval(timer)
    }
  }, [actions])

  const used = inUse(tracker, nowMs)
  const busy = new Set(
    packets.filter((p) => nowMs - p.startMs < 8 * p.hopMs + 500).map((p) => p.pathKey),
  )
  const flowPaths: PathFlowPath[] = used.map((p) => ({
    key: p.key,
    kind: p.kind,
    countries: p.countries,
    lit: highlight === 'busy' ? busy.has(p.key) || p.key === latestKey : p.key === latestKey,
  }))
  const stats = pathStats(tracker, nowMs)

  return (
    <YStack padding="$md" gap="$lg" testID={ELEMENT.settings.pathScreen}>
      <Text size="$body" tone="secondary">
        {tr('onionRoutingPathDescription')}
      </Text>
      {flowPaths.length === 0 ? (
        <Text size="$body" tone="secondary">
          {PENDING_COPY.onionRoutingPathWaiting}
        </Text>
      ) : (
        <PathFlow
          paths={flowPaths}
          packets={packets.filter((p) => used.some((u) => u.key === p.pathKey))}
          onionLayers
          columnTitles={[
            tr('you'),
            tr('onionRoutingPathEntryNode'),
            tr('onionRoutingPathServiceNode'),
            PENDING_COPY.onionRoutingPathRelay,
            tr('onionRoutingPathDestination'),
          ]}
          labelFor={labelFor}
          testID={ELEMENT.settings.pathFlow}
        />
      )}
      <StatsCard stats={stats} />
      <SettingsGroup>
        <SettingsRow
          label={tr('learnMore')}
          icon="externalLink"
          onPress={() => confirmLink(modals, LEARN_MORE_URL)}
          testID={ELEMENT.settings.pathLearnMore}
        />
      </SettingsGroup>
      <SettingsGroup>
        {(['latest', 'busy'] as const).map((mode) => (
          <SettingsRow
            key={mode}
            label={
              mode === 'latest'
                ? PENDING_COPY.onionRoutingPathHighlightLatest
                : PENDING_COPY.onionRoutingPathHighlightBusy
            }
            trailing={highlight === mode ? <Icon name="check" size="sm" /> : null}
            onPress={() => setHighlight(mode)}
            testID={ELEMENT.settings.pathHighlight(mode)}
          />
        ))}
      </SettingsGroup>
      {tracker.attribution.length === 0 ? null : (
        <Text size="$caption" tone="secondary">
          {tracker.attribution}
        </Text>
      )}
    </YStack>
  )
}
