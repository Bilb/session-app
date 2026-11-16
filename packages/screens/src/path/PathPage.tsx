import { URLS } from '@session/app'
import { PENDING_COPY, tr } from '@session/localization'
import { useConversations, useSessionActions } from '@session/state'
import { ELEMENT } from '@session/test-ids'
import {
  Icon,
  PathFlow,
  pathFlowTripMs,
  SettingsGroup,
  SettingsRow,
  Text,
  useModals,
  XStack,
  YStack,
  type PathFlowPacket,
  type PathFlowPath,
} from '@session/ui'
import { useEffect, useRef, useState } from 'react'

import {
  EMPTY_TRACKER,
  expectedPathCount,
  hopMsFor,
  inUse,
  pathStats,
  trackSnapshot,
  type PathKind,
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

/** Anything that set off this long ago is home, however slow its path. */
const PACKET_LIFE_MS = 30_000

/** What each colour of path is for, worded on each render so a language change reaches it. */
function kindLabels(): Record<PathKind, string> {
  return {
    swarm: PENDING_COPY.onionRoutingPathYourMessages,
    node: PENDING_COPY.onionRoutingPathContactsGroups,
    community: tr('conversationsCommunities'),
    file: PENDING_COPY.onionRoutingPathFileServer,
  }
}

/**
 * A bar's label: the country's code on every platform, which fits every column at every width, and
 * the file server by name. An unknown country is its `?`.
 */
function labelFor(country: string): string {
  return country === 'FS' ? PENDING_COPY.onionRoutingPathFileServer : country
}

function ms(value: number | null, copy: string): string {
  return value === null ? '-' : copy.replace('{ms}', String(Math.round(value)))
}

/** A figure over what it counts, a quarter of the card wide. */
function Stat({
  label,
  value,
  name,
  timing,
}: {
  label: string
  value: string
  name: string
  timing: boolean
}) {
  return (
    <YStack flex={1} flexBasis={0} minWidth={0} testID={ELEMENT.settings.pathStat(name)}>
      {timing ? (
        <Text size="$body" weight="semibold" fontFamily="$mono" numberOfLines={1}>
          {value}
        </Text>
      ) : (
        <Text size="$title" weight="bold" numberOfLines={1}>
          {value}
        </Text>
      )}
      <Text size="$caption" tone="secondary">
        {label}
      </Text>
    </YStack>
  )
}

/** Two rows of four: what is in use, then how quickly it answers, under a rule. */
function StatsCard({ stats }: { stats: PathStats }) {
  return (
    <YStack
      gap="$xs"
      paddingVertical="$xs"
      paddingHorizontal="$sm"
      borderRadius="$md"
      backgroundColor="$backgroundSecondary"
    >
      <XStack gap="$2xs">
        <Stat
          name="in-use"
          label={PENDING_COPY.onionRoutingPathsInUse}
          value={String(stats.pathsInUse)}
          timing={false}
        />
        <Stat
          name="countries"
          label={PENDING_COPY.onionRoutingPathCountries}
          value={String(stats.countriesCrossed)}
          timing={false}
        />
        <Stat
          name="entry"
          label={PENDING_COPY.onionRoutingPathEntryNodes}
          value={String(stats.entryNodes)}
          timing={false}
        />
        <Stat
          name="rebuilt"
          label={PENDING_COPY.onionRoutingPathRebuilt}
          value={String(stats.rebuilt)}
          timing={false}
        />
      </XStack>
      <XStack gap="$2xs" borderTopWidth={1} borderColor="$separatorColor" paddingTop="$xs">
        <Stat
          name="average"
          label={PENDING_COPY.onionRoutingPathAverage}
          value={ms(stats.averageMs, PENDING_COPY.onionRoutingPathMilliseconds)}
          timing
        />
        <Stat
          name="fastest"
          label={PENDING_COPY.onionRoutingPathFastest}
          value={ms(stats.fastestMs, PENDING_COPY.onionRoutingPathMilliseconds)}
          timing
        />
        <Stat
          name="slowest"
          label={PENDING_COPY.onionRoutingPathSlowest}
          value={ms(stats.slowestMs, PENDING_COPY.onionRoutingPathMilliseconds)}
          timing
        />
        <Stat
          name="jitter"
          label={PENDING_COPY.onionRoutingPathJitter}
          value={ms(stats.jitterMs, PENDING_COPY.onionRoutingPathJitterMilliseconds)}
          timing
        />
      </XStack>
    </YStack>
  )
}

/**
 * Every path the client is using, drawn as a country flow: from you through the country of each
 * relay to the destination, with each request travelling its path and back at a speed taken from
 * that path's measured round trip, and the router's pings as fainter traffic between them. A child
 * screen; the settings modal supplies the chrome.
 *
 * Polls libsession once a second while open, and not at all otherwise.
 */
export function PathPage() {
  const actions = useSessionActions()
  const conversations = useConversations()
  const modals = useModals()
  const [tracker, setTracker] = useState<PathTracker>(EMPTY_TRACKER)
  const [packets, setPackets] = useState<PathFlowPacket[]>([])
  const [latestKey, setLatestKey] = useState<string | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const trackerRef = useRef(tracker)

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
      const latest = requests.filter((r) => r.kind === 'request').at(-1)
      if (latest) setLatestKey(latest.pathKey)
      if (requests.length > 0) {
        const latency = new Map(next.paths.map((p) => [p.key, p.latencyMs]))
        setPackets((was) => [
          ...was.filter((p) => now - p.startMs < PACKET_LIFE_MS),
          ...requests.map((r) => ({
            id: r.id,
            pathKey: r.pathKey,
            startMs: r.atMs,
            hopMs: hopMsFor(latency.get(r.pathKey) ?? 0),
            quiet: r.kind === 'ping',
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
  const kinds = new Map(used.map((p) => [p.key, p.kind]))
  // A ping says only that a path is alive, so it never lights one.
  const busy = new Set(
    packets
      .filter((p) => {
        const kind = kinds.get(p.pathKey)
        return (
          p.quiet !== true &&
          kind !== undefined &&
          nowMs - p.startMs < pathFlowTripMs(p.hopMs, kind, true)
        )
      })
      .map((p) => p.pathKey),
  )
  const flowPaths: PathFlowPath[] = used.map((p) => ({
    key: p.key,
    kind: p.kind,
    countries: p.countries,
    standby: p.standby,
    lit: busy.has(p.key) || p.key === latestKey,
  }))
  const stats = pathStats(tracker, nowMs)

  return (
    <YStack padding="$md" gap="$lg" testID={ELEMENT.settings.pathScreen}>
      <Text size="$body" tone="secondary">
        {PENDING_COPY.onionRoutingPathIntro}
      </Text>
      {/* Not drawn until the first snapshot is in, a moment after opening, which already holds
          every path in use: the card opens at its height rather than growing into it. */}
      {tracker.lastPollMs === null ? null : (
        <YStack gap="$xs">
          <PathFlow
            paths={flowPaths}
            countryOrder={tracker.countryOrder}
            packets={packets.filter((p) => kinds.has(p.pathKey))}
            onionLayers
            columnTitles={[
              tr('you'),
              PENDING_COPY.onionRoutingPathEntry,
              PENDING_COPY.onionRoutingPathRelay,
              PENDING_COPY.onionRoutingPathRelay,
              tr('onionRoutingPathDestination'),
            ]}
            labelFor={labelFor}
            kindLabels={kindLabels()}
            buildingLabel={PENDING_COPY.onionRoutingPathBuilding}
            expectedPaths={expectedPathCount(conversations)}
            testID={ELEMENT.settings.pathFlow}
          />
          <StatsCard stats={stats} />
        </YStack>
      )}
      <SettingsGroup>
        <SettingsRow
          label={tr('learnMore')}
          // As the help screen's links: the accent on dark, body text on light.
          trailing={<Icon name="externalLink" size="md" color="$accentText" />}
          onPress={() => confirmLink(modals, LEARN_MORE_URL)}
          testID={ELEMENT.settings.pathLearnMore}
        />
      </SettingsGroup>
      {tracker.attribution.length === 0 ? null : (
        <Text size="$caption" tone="secondary">
          {tracker.attribution}
        </Text>
      )}
    </YStack>
  )
}
