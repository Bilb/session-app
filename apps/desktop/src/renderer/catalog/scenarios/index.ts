import type { AnyStory } from '@session/ui/catalog'

import { MESSAGE_SCENARIOS } from './messages'
import { RAIL_SCENARIOS } from './rail'
import { SETTINGS_SCENARIOS } from './settings'
import { STARTUP_FAILED_SCENARIOS } from './startupFailed'

export { ScenarioProvider } from './ScenarioProvider'

/** Stories drawn from the fake's store, each needing `ScenarioProvider` above its page. */
export const SCENARIOS: readonly AnyStory[] = [
  ...MESSAGE_SCENARIOS,
  ...RAIL_SCENARIOS,
  ...SETTINGS_SCENARIOS,
  ...STARTUP_FAILED_SCENARIOS,
]
