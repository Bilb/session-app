import { PathFlow, type PathFlowKind, type PathFlowPacket, type PathFlowPath } from '../../PathFlow'
import { defineStory } from '../story'

const TITLES = ['You', 'Entry', 'Relay', 'Relay', 'Destination'] as const

/** The network's countries by how many nodes they hold, as they were in November 2026. */
const COUNTRY_ORDER = [
  'DE', 'US', 'FI', 'GB', 'CA', 'FR', 'NL', 'SE', 'SG', 'PL', 'ZA', 'AU',
  'BG', 'JP', 'CZ', 'AE', 'IE', 'TH', 'IN', 'MY', 'KR', 'IT', 'RO', 'TR',
] as const // prettier-ignore

const NAMES: Record<string, string> = {
  DE: 'Germany',
  US: 'United States',
  FI: 'Finland',
  NL: 'Netherlands',
  CA: 'Canada',
  FS: 'File server',
  '?': 'Unknown Country',
}

const labelFor = (country: string) => NAMES[country] ?? country

const KIND_LABELS: Record<PathFlowKind, string> = {
  swarm: 'Your messages',
  node: 'Contacts and groups',
  community: 'Communities',
  file: 'File server',
}

/**
 * Shapes measured on mainnet: mostly Germany, the United States and Finland, a few elsewhere. Your
 * swarm's current path, its standby, and the file server's.
 */
const QUIET: PathFlowPath[] = [
  { key: 'swarm', kind: 'swarm', countries: ['DE', 'US', 'FI', 'DE'], lit: true },
  { key: 'swarm~1', kind: 'swarm', countries: ['FI', 'DE', 'US', 'DE'], lit: false, standby: true },
  { key: 'f1', kind: 'file', countries: ['US', 'FI', 'DE', 'FS'], lit: false },
]

const BUSY: PathFlowPath[] = [
  { key: 'swarm', kind: 'swarm', countries: ['DE', 'US', 'FI', 'DE'], lit: true },
  { key: 'g1', kind: 'node', countries: ['DE', 'FI', 'DE', 'US'], lit: false },
  { key: 'g2', kind: 'node', countries: ['US', 'DE', 'DE', 'FI'], lit: true },
  { key: 'g3', kind: 'node', countries: ['NL', 'US', 'CA', 'DE'], lit: false },
  { key: 'c1', kind: 'community', countries: ['DE', 'DE', 'US', 'US'], lit: false },
  { key: 'f1', kind: 'file', countries: ['US', 'FI', 'DE', 'FS'], lit: false },
  { key: 'g4', kind: 'node', countries: ['FI', 'DE', 'US', 'DE'], lit: false },
  { key: 'g5', kind: 'node', countries: ['DE', 'US', 'FI', 'FI'], lit: false },
]

/** The moment the still is drawn at, and one link's time: what the packets below are timed by. */
const STILL_AT_MS = 10_000
const HOP_MS = 320

/**
 * A request held at the second relay as its layer comes off (out one link, held, out another, then
 * 60 ms into the hold), a ping halfway along its second link, and one just leaving for the file
 * server's pivot.
 */
const PACKETS: PathFlowPacket[] = [
  {
    id: 'request',
    pathKey: 'swarm',
    startMs: STILL_AT_MS - (2 * HOP_MS + 160 + 60),
    hopMs: HOP_MS,
  },
  {
    id: 'ping',
    pathKey: 'swarm~1',
    startMs: STILL_AT_MS - 1.5 * HOP_MS,
    hopMs: HOP_MS,
    quiet: true,
  },
  { id: 'ping-fs', pathKey: 'f1', startMs: STILL_AT_MS - 0.6 * HOP_MS, hopMs: HOP_MS, quiet: true },
]

/** A hop whose address is not in the country table, and a build that carries none. */
const UNKNOWN: PathFlowPath[] = [
  { key: 'swarm', kind: 'swarm', countries: ['DE', null, 'FI', 'DE'], lit: true },
  { key: 'f1', kind: 'file', countries: [null, null, null, 'FS'], lit: false },
]

/**
 * The country flow, still: the requests that travel it are motion, which a capture cannot hold.
 * Lit lines against faint ones, a dashed standby, every kind's colour with its legend, a bar for an
 * unknown country, the drawing before any path is built, and a request and pings caught still.
 */
export const pathFlow = defineStory<{
  paths: PathFlowPath[]
  packets?: PathFlowPacket[] | undefined
}>({
  component: 'pathFlow',
  story: 'countries',
  width: 390,
  sensitive: { theme: true },
  variants: {
    building: { paths: [] },
    quiet: { paths: QUIET },
    requests: { paths: QUIET, packets: PACKETS },
    busy: { paths: BUSY },
    unknown: { paths: UNKNOWN },
  },
  render: ({ paths, packets }) => (
    <PathFlow
      paths={paths}
      countryOrder={COUNTRY_ORDER}
      packets={packets ?? []}
      stillAtMs={packets === undefined ? undefined : STILL_AT_MS}
      onionLayers
      columnTitles={TITLES}
      labelFor={labelFor}
      kindLabels={KIND_LABELS}
      buildingLabel="Building paths"
    />
  ),
})
