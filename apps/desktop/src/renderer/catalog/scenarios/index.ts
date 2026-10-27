import type { AnyStory } from '@session/ui/catalog'

import { MESSAGE_SCENARIOS } from './messages'

export { PicturesProvider, ScenarioProvider } from './ScenarioProvider'

/** Stories drawn from the fake's showcase, each needing `ScenarioProvider` above its page. */
export const SCENARIOS: readonly AnyStory[] = [...MESSAGE_SCENARIOS]
