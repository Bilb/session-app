import type { AnyStory } from '@session/ui/catalog'

import { COMPOSER_SCENARIOS } from './composer'
import { MESSAGE_SCENARIOS } from './messages'

export { PicturesProvider, ScenarioProvider } from './ScenarioProvider'

/** Stories drawn from the fake's showcase and its pictures, with `ScenarioProvider` above each. */
export const SCENARIOS: readonly AnyStory[] = [...MESSAGE_SCENARIOS, ...COMPOSER_SCENARIOS]
