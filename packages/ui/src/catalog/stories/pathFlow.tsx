import { PathFlow, type PathFlowPath } from '../../PathFlow'
import { defineStory } from '../story'

const TITLES = ['You', 'Entry', 'Relay', 'Relay', 'Destination'] as const

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

/** Shapes measured on mainnet: mostly Germany, the United States and Finland, a few elsewhere. */
const ONE: PathFlowPath[] = [
  { key: 'swarm', kind: 'swarm', countries: ['DE', 'US', 'FI', 'DE'], lit: true },
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

/** A hop whose address is not in the country table, and a build that carries none. */
const UNKNOWN: PathFlowPath[] = [
  { key: 'swarm', kind: 'swarm', countries: ['DE', null, 'FI', 'DE'], lit: true },
  { key: 'f1', kind: 'file', countries: [null, null, null, 'FS'], lit: false },
]

/**
 * The country flow, still: the requests that travel it are motion, which a capture cannot hold.
 * Lit lines against faint ones, every kind's colour, and a bar for an unknown country.
 */
export const pathFlow = defineStory<{ paths: PathFlowPath[] }>({
  component: 'pathFlow',
  story: 'countries',
  width: 390,
  sensitive: { theme: true },
  variants: {
    one: { paths: ONE },
    busy: { paths: BUSY },
    unknown: { paths: UNKNOWN },
  },
  render: ({ paths }) => (
    <PathFlow paths={paths} packets={[]} onionLayers columnTitles={TITLES} labelFor={labelFor} />
  ),
})
