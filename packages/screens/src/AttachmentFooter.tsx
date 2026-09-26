import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { PressArea, SegmentedToggle, Text, XStack, type Segment } from '@session/ui'

import type { AttachmentSet } from './attachmentSet'
import type { AttachmentView } from './attachmentView'
import { formatBytes } from './formatBytes'
import { PENDING_COPY } from './pendingCopy'

/**
 * The one line a message's attachments get, whatever they are doing.
 *
 * **Always drawn, and always the same height.** A footer that appeared when a download finished
 * would change the message's height at the moment somebody is reading it, and in a transcript
 * that moves everything below. Only the words and the verb change between states.
 *
 * Its scope is the message rather than the gallery: the count is every attachment, including the
 * ones behind "+N" that are never drawn.
 */
export function AttachmentFooter({
  set,
  onAction,
  view,
  onView,
}: {
  set: AttachmentSet
  onAction: () => void
  /** The shape being drawn. Absent where the reader has no choice about it. */
  view?: AttachmentView
  onView?: (view: AttachmentView) => void
}) {
  const action = verb(set)
  return (
    <XStack
      height={FOOTER_HEIGHT}
      alignItems="center"
      gap="$xs"
      testID={ELEMENT.conversation.attachmentFooter}
    >
      {view === undefined || onView === undefined ? null : (
        <SegmentedToggle segments={VIEW_SEGMENTS} value={view} onChange={onView} />
      )}
      <Text
        size="$caption"
        color="$textSecondary"
        flex={1}
        numberOfLines={1}
        testID={ELEMENT.conversation.attachmentState}
      >
        {caption(set)}
      </Text>
      {action === null ? null : (
        <PressArea
          onPress={onAction}
          accessibilityLabel={action}
          testID={ELEMENT.conversation.attachmentAction}
        >
          {() => (
            <Text
              size="$caption"
              weight="semibold"
              color={set.state === 'failed' ? '$dangerColor' : '$accentText'}
            >
              {action}
            </Text>
          )}
        </PressArea>
      )}
    </XStack>
  )
}

/**
 * Tall enough for a caption and its touch target, and fixed.
 *
 * A number rather than letting the text set it: the whole point is that the height does not
 * change between states, and a line of copy that wraps in one locale would change it.
 */
const FOOTER_HEIGHT = 30

/**
 * Gallery or list, for a set that can be drawn either way.
 *
 * **Not a failure fallback.** Five photographs read perfectly well as five rows - with a name, a
 * size and a control each - and that is a reasonable thing to want without anything having gone
 * wrong. Where the set has a plain file in it there is no choice to offer, and the footer draws
 * no toggle rather than one with one working half.
 */
const VIEW_SEGMENTS: readonly [Segment<AttachmentView>, Segment<AttachmentView>] = [
  {
    value: 'gallery',
    icon: 'layoutGrid',
    label: PENDING_COPY.attachmentViewGallery,
    testID: ELEMENT.conversation.attachmentViewGallery,
  },
  {
    value: 'list',
    icon: 'list',
    label: PENDING_COPY.attachmentViewList,
    testID: ELEMENT.conversation.attachmentViewList,
  },
]

function caption(set: AttachmentSet): string {
  if (set.state === 'fetching') {
    // Indeterminate until the server says how big it is, which is what a total of 0 means - the
    // first report of any transfer is 0 of 0.
    if (set.totalBytes === 0) return tr('downloading')
    return `${formatBytes(set.doneBytes)} / ${formatBytes(set.totalBytes)}`
  }
  if (set.state === 'failed') return tr('failedToDownload')
  return set.sizeBytes === undefined ? '' : formatBytes(set.sizeBytes)
}

/**
 * The one thing this state offers, or null where it offers nothing.
 *
 * Null rather than a disabled word, and the height does not move either way. There is no verb
 * while a transfer runs because nothing can stop one yet - the bridge has no cancel - and none on
 * a set of several that has arrived, because saving them needs a directory to put them in and
 * offering one Save that quietly writes the first is worse than offering none.
 */
function verb(set: AttachmentSet): string | null {
  if (set.state === 'fetching') return null
  if (set.state === 'failed') return tr('retry')
  if (set.state === 'ready') return set.count === 1 ? PENDING_COPY.export : null
  return tr('download')
}
