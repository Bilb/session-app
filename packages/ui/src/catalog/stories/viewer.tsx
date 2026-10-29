import { ELEMENT } from '@session/test-ids'
import { useContext } from 'react'
import { YStack } from 'tamagui'

import { MediaViewerBody, type MediaViewerItem } from '../../MediaViewer'
import { CatalogPictures } from '../pictures'
import { defineStory } from '../story'
import { noop } from './shared'

/** A phone's width and enough height for the chevrons to sit on the picture's middle. */
const VIEWER_WIDTH = 390
const VIEWER_HEIGHT = 520

/**
 * What one item of the set is: a picture, one libsession is still making, one it refused to make,
 * or one never drawn.
 */
type Shown = 'picture' | 'preparing' | 'failed' | 'unsupported'

interface ViewerRow {
  set: readonly Shown[]
  index: number
}

function Viewer({ set, index }: ViewerRow) {
  const pictures = useContext(CatalogPictures)
  const items = set.map((shown, at): MediaViewerItem => {
    const picture = pictures.length === 0 ? null : (pictures[at % pictures.length] ?? null)
    if (shown === 'picture') return { uri: picture }
    // The url it loads out of sight is the ask; any that loads cleanly keeps the page quiet.
    if (shown === 'preparing') return { uri: null, preparing: picture }
    if (shown === 'failed') return { uri: null, failed: true }
    return { uri: null }
  })
  return (
    <YStack width={VIEWER_WIDTH} height={VIEWER_HEIGHT}>
      <MediaViewerBody
        items={items}
        index={index}
        onIndex={noop}
        onClose={noop}
        onExport={noop}
        positionLabel={`${String(index + 1)} of ${String(set.length)}`}
        unavailableLabel="This file type is not supported."
        failedLabel="Unable to open file."
        preparingLabel="Loading..."
        closeLabel="Close"
        exportLabel="Export"
        previousLabel="Previous"
        nextLabel="Next"
        testID={ELEMENT.conversation.mediaViewer}
        closeTestID={ELEMENT.conversation.mediaViewerClose}
        exportTestID={ELEMENT.conversation.mediaViewerExport}
        previousTestID={ELEMENT.conversation.mediaViewerPrevious}
        nextTestID={ELEMENT.conversation.mediaViewerNext}
        imageTestID={ELEMENT.conversation.mediaViewerImage}
        preparingTestID={ELEMENT.conversation.mediaViewerPreparing}
      />
    </YStack>
  )
}

const THREE_PICTURES: readonly Shown[] = ['picture', 'picture', 'picture']

export const mediaViewer = defineStory<ViewerRow>({
  component: 'mediaViewer',
  story: 'states',
  width: VIEWER_WIDTH,
  sensitive: { rtl: true },
  variants: {
    middleOfThree: { set: THREE_PICTURES, index: 1 },
    firstOfThree: { set: THREE_PICTURES, index: 0 },
    lastOfThree: { set: THREE_PICTURES, index: 2 },
    preparing: { set: ['picture', 'preparing', 'picture'], index: 1 },
    unsupported: { set: ['picture', 'unsupported'], index: 1 },
    alone: { set: ['picture'], index: 0 },
    failed: { set: ['picture', 'failed', 'picture'], index: 1 },
  },
  render: (row) => <Viewer {...row} />,
})
