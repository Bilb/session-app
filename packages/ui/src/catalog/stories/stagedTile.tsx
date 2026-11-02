import { ELEMENT } from '@session/test-ids'

import { StagedTile, type StagedTileProps } from '../../StagedTile'
import { STAGED_TILE_SIDE } from '../../stagingMetrics'
import { defineStory } from '../story'
import { noop } from './shared'

/** A size as the composer passes it, isolated: under a right-to-left name it reads "kB 180". */
const isolated = (size: string) => `⁨${size}⁩`

function tile(
  index: number,
  name: string,
  contentType: string,
  size: string | undefined,
): StagedTileProps {
  return {
    name,
    contentType,
    sizeLabel: size === undefined ? undefined : isolated(size),
    label: name,
    onRemove: noop,
    removeLabel: `Remove ${name}`,
    testID: ELEMENT.conversation.stagedTile(index),
    removeTestID: ELEMENT.conversation.stagedRemove(index),
    previewTestID: ELEMENT.conversation.stagedPreview(index),
  }
}

/**
 * A file waiting in the composer, as its document face. The name and its size share the name's
 * direction, so an Arabic name sets both at the right edge, the size still number first.
 */
export const stagedTile = defineStory<StagedTileProps>({
  component: 'stagedTile',
  story: 'faces',
  width: STAGED_TILE_SIDE,
  sensitive: { rtl: true },
  variants: {
    document: tile(0, 'report.pdf', 'application/pdf', '180 kB'),
    arabicName: tile(1, 'تقرير-الربع-الثالث.pdf', 'application/pdf', '180 kB'),
    unsized: tile(2, 'notes.txt', 'text/plain', undefined),
    longName: tile(
      3,
      'quarterly-board-meeting-minutes-final-revised-v7.pdf',
      'application/pdf',
      '18.4 MB',
    ),
  },
  render: (props) => <StagedTile {...props} />,
})
