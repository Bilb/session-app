import { Text, UIProvider, YStack } from '@session/ui'
import {
  CatalogPage,
  catalogPages,
  cellsOn,
  layoutOf,
  STORIES,
  type CatalogPageSpec,
  type CatalogTier,
} from '@session/ui/catalog'
import { useSyncExternalStore } from 'react'

import { RemoveLaunchScreenOnMount } from '../launchScreen'
import { PicturesProvider, SCENARIOS, ScenarioProvider } from './scenarios'

const PREFIX = '#/catalog/'

const ALL_STORIES = [...STORIES, ...SCENARIOS]

const TIERS: readonly CatalogTier[] = ['pr', 'nightly']

// The tiers share ids (`-rtl`, `-w320`) for different pages, so an id is only looked up in its own.
const PAGES: Record<CatalogTier, CatalogPageSpec[]> = {
  pr: catalogPages('pr', ALL_STORIES),
  nightly: catalogPages('nightly', ALL_STORIES),
}

declare global {
  interface Window {
    /** What the catalog spec reads to know which pages to visit. */
    sessionCatalog: { pages: (tier: CatalogTier) => CatalogPageSummary[] }
  }
}

interface CatalogPageSummary {
  id: string
  /** `component.story`, which names an audit finding whatever page or column it was on. */
  story: string
  rows: string[]
  cells: number
  /** Shared by the pages that differ only in colour: see `layoutOf`. */
  layout: string
}

window.sessionCatalog = {
  pages: (tier) =>
    PAGES[tier].map((page) => ({
      id: page.id,
      story: `${page.story.component}.${page.story.story}`,
      rows: Object.keys(page.story.variants),
      cells: cellsOn(page),
      layout: layoutOf(page),
    })),
}

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

const readHash = () => window.location.hash

function Index() {
  return (
    <YStack padding="$md" gap="$2xs">
      {TIERS.flatMap((tier) =>
        PAGES[tier].map(({ id }) => (
          <Text
            key={`${tier}/${id}`}
            size="$label"
            onPress={() => {
              window.location.hash = `${PREFIX}${tier}/${encodeURIComponent(id)}`
            }}
          >
            {`${tier}/${id}`}
          </Text>
        )),
      )}
    </YStack>
  )
}

/** `#/catalog/<tier>/<id>`: the page it names, if there is one. */
function pageAt(hash: string): CatalogPageSpec | undefined {
  if (!hash.startsWith(PREFIX)) return undefined
  const [tier, id] = hash.slice(PREFIX.length).split('/')
  if (tier !== 'pr' && tier !== 'nightly') return undefined
  return PAGES[tier].find((candidate) => candidate.id === decodeURIComponent(id ?? ''))
}

/** The page the URL's hash names, or the list of them: the spec moves between pages by hash. */
export default function Catalog() {
  const hash = useSyncExternalStore(subscribe, readHash)
  const page = pageAt(hash)
  const drawn = page === undefined ? <Index /> : <CatalogPage key={page.id} page={page} />
  return (
    <UIProvider>
      <RemoveLaunchScreenOnMount />
      {page === undefined ? (
        drawn
      ) : SCENARIOS.includes(page.story) ? (
        <ScenarioProvider>{drawn}</ScenarioProvider>
      ) : page.story.pictures === true ? (
        <PicturesProvider>{drawn}</PicturesProvider>
      ) : (
        drawn
      )}
    </UIProvider>
  )
}
