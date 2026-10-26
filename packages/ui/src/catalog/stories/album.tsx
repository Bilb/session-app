import { ELEMENT } from '@session/test-ids'

import { AttachmentAlbum, type AlbumItem } from '../../AttachmentAlbum'
import { defineStory } from '../story'
import { MESSAGE_FRAME_INSET_PX, MessageFrame } from '../../MessageFrame'
import { noop } from './shared'

const ALBUM_WIDTH = 300

/** Placeholders, with no picture to fetch: what is drawn here is the tiles and their rings. */
const tiles = (count: number): AlbumItem[] =>
  Array.from({ length: count }, (_, at) => ({ label: `${String(at + 1)}.jpg`, hint: 'Open' }))

interface AlbumStory {
  count: number
  onAccent: boolean
}

function Album({ count, onAccent }: AlbumStory) {
  return (
    <AttachmentAlbum
      items={tiles(count)}
      width={ALBUM_WIDTH}
      overflowLabel={(more) => `+${String(more)}`}
      overflowName={(label, more) => `${label} and ${String(more)} more`}
      onOpen={noop}
      fetchLabel="Download"
      fetchTestID={ELEMENT.conversation.attachmentFetch}
      tileTestID={ELEMENT.conversation.attachmentTile}
      onAccent={onAccent}
      testID={ELEMENT.conversation.attachment}
    />
  )
}

/** Each tile's focus ring, inside the seam so the next tile does not paint over it. */
export const albumFocus = defineStory<AlbumStory>({
  component: 'album',
  story: 'focus',
  width: ALBUM_WIDTH + 2 * MESSAGE_FRAME_INSET_PX,
  forced: ['focus'],
  sensitive: { accent: true },
  variants: {
    three: { count: 3, onAccent: false },
    five: { count: 5, onAccent: false },
    threeOnAccent: { count: 3, onAccent: true },
  },
  render: (props) => (
    <MessageFrame outgoing={props.onAccent}>
      <Album {...props} />
    </MessageFrame>
  ),
})
