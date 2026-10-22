import { Text, UIProvider, YStack } from '@session/ui'
import { CatalogPage, catalogPages, cellsOn, STORIES, type CatalogTier } from '@session/ui/catalog'
import { useSyncExternalStore } from 'react'

import { SCENARIOS, ScenarioProvider } from './catalogScenarios'
import { RemoveLaunchScreenOnMount } from './launchScreen'

const PREFIX = '#/catalog/'

const ALL_STORIES = [...STORIES, ...SCENARIOS]

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
}

window.sessionCatalog = {
  pages: (tier) =>
    catalogPages(tier, ALL_STORIES).map((page) => ({
      id: page.id,
      story: `${page.story.component}.${page.story.story}`,
      rows: Object.keys(page.story.variants),
      cells: cellsOn(page),
    })),
}

const ALL_PAGES = [...catalogPages('pr', ALL_STORIES), ...catalogPages('nightly', ALL_STORIES)]

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

const readHash = () => window.location.hash

function Index() {
  return (
    <YStack padding="$md" gap="$2xs">
      {ALL_PAGES.map(({ id }) => (
        <Text
          key={id}
          size="$label"
          onPress={() => {
            window.location.hash = `${PREFIX}${encodeURIComponent(id)}`
          }}
        >
          {id}
        </Text>
      ))}
    </YStack>
  )
}

/** The page the URL's hash names, or the list of them: the spec moves between pages by hash. */
export default function Catalog() {
  const hash = useSyncExternalStore(subscribe, readHash)
  const id = hash.startsWith(PREFIX) ? decodeURIComponent(hash.slice(PREFIX.length)) : null
  const page = ALL_PAGES.find((candidate) => candidate.id === id)
  const drawn = page === undefined ? <Index /> : <CatalogPage key={page.id} page={page} />
  return (
    <UIProvider>
      <RemoveLaunchScreenOnMount />
      {page !== undefined && SCENARIOS.includes(page.story) ? (
        <ScenarioProvider>{drawn}</ScenarioProvider>
      ) : (
        drawn
      )}
    </UIProvider>
  )
}
