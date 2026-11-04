import type { AnyStory } from '@session/ui/catalog'

import { COMPOSER_SCENARIOS } from './composer'
import { MESSAGE_SCENARIOS } from './messages'
import { RAIL_SCENARIOS } from './rail'
import { SETTINGS_SCENARIOS } from './settings'
import { SHEET_SCENARIOS } from './sheet'

export { PicturesProvider, ScenarioProvider } from './ScenarioProvider'

/** Stories drawn from the fake's store and its pictures, with `ScenarioProvider` above each. */
export const SCENARIOS: readonly AnyStory[] = [
  ...MESSAGE_SCENARIOS,
  ...COMPOSER_SCENARIOS,
  ...RAIL_SCENARIOS,
  ...SHEET_SCENARIOS,
  ...SETTINGS_SCENARIOS,
]
