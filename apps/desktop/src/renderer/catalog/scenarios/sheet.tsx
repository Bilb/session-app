import { DetachedAttachmentSheet } from '@session/screens'
import { defineStory, type AnyStory } from '@session/ui/catalog'
import { YStack } from '@session/ui'

import { useScenario } from './ScenarioProvider'

/** A row is a message of the `showcase` fixture, found by its body, with its sheet open. */
interface SheetRow {
  body: string
}

/** The sheet's widest, as a dialog. */
const SHEET_WIDTH = 460
/** A window tall enough that the sheet's 80% shows several rows and its footer. */
const WINDOW_HEIGHT = 640

function ScenarioSheet({ body }: SheetRow) {
  const scenario = useScenario()
  const messageId = scenario?.messageIds.get(body)
  if (scenario === null || messageId === undefined) return null
  return (
    <YStack width={SHEET_WIDTH} height={WINDOW_HEIGHT}>
      <DetachedAttachmentSheet conversationId={scenario.conversationId} messageId={messageId} />
    </YStack>
  )
}

/** Show All on our own sends: each file's state, the footer, and the one that failed in view. */
const attachmentSheet = defineStory<SheetRow>({
  component: 'attachmentSheet',
  story: 'sending',
  width: SHEET_WIDTH,
  // The upload ring is the accent's, and the rows and footer have a leading and a trailing end.
  sensitive: { accent: true, rtl: true },
  variants: {
    'File 31 of 32 failed': { body: 'File 31 of 32 failed' },
    'Still uploading, one at a time': { body: 'Still uploading, one at a time' },
  },
  render: (row) => <ScenarioSheet {...row} />,
})

export const SHEET_SCENARIOS: readonly AnyStory[] = [attachmentSheet]
