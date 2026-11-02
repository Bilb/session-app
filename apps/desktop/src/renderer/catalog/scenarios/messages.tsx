import { MessageRow } from '@session/screens'
import { defineStory, type AnyStory } from '@session/ui/catalog'

import { useScenario } from './ScenarioProvider'

/** A row is a message of the `showcase` fixture, found by its body. */
interface ScenarioRow {
  body: string
}

function ScenarioMessage({ body }: ScenarioRow) {
  const scenario = useScenario()
  const messageId = scenario?.messageIds.get(body)
  if (scenario === null || messageId === undefined) return null
  return <MessageRow conversationId={scenario.conversationId} messageId={messageId} index={0} />
}

const MESSAGE_WIDTH = 420

const message = (story: string, bodies: readonly string[], sensitive: AnyStory['sensitive']) =>
  defineStory<ScenarioRow>({
    component: 'message',
    story,
    width: MESSAGE_WIDTH,
    sensitive,
    variants: Object.fromEntries(bodies.map((body) => [body, { body }])),
    render: (row) => <ScenarioMessage {...row} />,
  })

export const MESSAGE_SCENARIOS: readonly AnyStory[] = [
  message(
    'albumShapes',
    [
      'One picture',
      'Three: one above two',
      'Twelve, so seven are behind the count',
      'Three with no hash to draw',
      'Five with no hash to draw',
    ],
    { responsive: true },
  ),
  message(
    'albumStates',
    ['Two, one above the other', 'Four in two rows', 'Five: two above three', 'Thirty-two'],
    {},
  ),
  message(
    'files',
    [
      'A clip on its own',
      'Pictures and a clip',
      'Paperwork only',
      'A recording',
      'The whole roll',
      'One of these is gone',
      'Four of these five are gone',
    ],
    { rtl: true },
  ),
]
