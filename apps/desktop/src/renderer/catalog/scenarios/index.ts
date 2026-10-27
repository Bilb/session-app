import type { AnyStory } from '@session/ui/catalog'

import { MESSAGE_SCENARIOS } from './messages'
import { RAIL_SCENARIOS } from './rail'

export { ScenarioProvider } from './ScenarioProvider'

/** Stories drawn from the fake's store, each needing `ScenarioProvider` above its page. */
export const SCENARIOS: readonly AnyStory[] = [...MESSAGE_SCENARIOS, ...RAIL_SCENARIOS]
