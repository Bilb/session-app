import { ELEMENT } from '@session/test-ids'
import { describe, expect, it } from 'vitest'

import { MediaViewer, type MediaViewerItem } from '#src/MediaViewer'

import { renderInUI } from './support/render'

function viewer(items: readonly MediaViewerItem[]) {
  return renderInUI(
    <MediaViewer
      open
      items={items}
      index={0}
      onIndex={() => {}}
      onClose={() => {}}
      onExport={() => {}}
      positionLabel="1 / 1"
      unavailableLabel="Not supported"
      failedLabel="Unable to open"
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
    />,
  )
}

describe('the viewer on a picture still being made', () => {
  it('says it is loading and loads the url that asks for it, out of sight', () => {
    const { getByText, baseElement } = viewer([{ uri: null, preparing: 'rendition://7/2' }])
    expect(getByText('Loading...')).toBeTruthy()
    expect(baseElement.querySelector('img[src="rendition://7/2"]')).not.toBeNull()
  })

  it('says a picture with no resolver is not supported, rather than loading', () => {
    const { getByText } = viewer([{ uri: null }])
    expect(getByText('Not supported')).toBeTruthy()
  })
})
