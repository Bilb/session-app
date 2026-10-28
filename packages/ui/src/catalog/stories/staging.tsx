import { formatBytes, MAX_ATTACHMENTS_PER_MESSAGE } from '@session/basic-types'
import { ELEMENT } from '@session/test-ids'
import { YStack } from 'tamagui'

import { ComposerNotice } from '../../ComposerNotice'
import { DropOverlay } from '../../DropOverlay'
import { StagedTile } from '../../StagedTile'
import { StagedTray } from '../../StagedTray'
import { STAGED_TILE_SIDE } from '../../stagingMetrics'
import { useCatalogPicture } from '../pictures'
import { defineStory } from '../story'
import { noop } from './shared'

interface TileRow {
  name: string
  contentType: string
  sizeLabel?: string | undefined
  /** Which of the catalog's photographs it draws as its staged thumbnail, if any. */
  picture?: number | undefined
}

function Tile({ name, contentType, sizeLabel, picture, index }: TileRow & { index: number }) {
  const previewUrl = useCatalogPicture(picture)
  return (
    <StagedTile
      name={name}
      contentType={contentType}
      sizeLabel={sizeLabel}
      previewUrl={previewUrl}
      label={[name, sizeLabel].filter(Boolean).join(', ')}
      removeLabel={`Remove ${name}`}
      onRemove={noop}
      testID={ELEMENT.conversation.stagedTile(index)}
      removeTestID={ELEMENT.conversation.stagedRemove(index)}
      previewTestID={ELEMENT.conversation.stagedPreview(index)}
    />
  )
}

const PDF = 'application/pdf'

export const stagedTile = defineStory<TileRow>({
  component: 'stagedTile',
  story: 'faces',
  width: STAGED_TILE_SIDE,
  forced: ['hover', 'focus', 'press'],
  sensitive: { rtl: true },
  variants: {
    picture: { name: 'harbour.jpg', contentType: 'image/jpeg', sizeLabel: '2.4 MB', picture: 0 },
    noPreviewYet: { name: 'harbour.jpg', contentType: 'image/jpeg', sizeLabel: '2.4 MB' },
    video: { name: 'ferry.mp4', contentType: 'video/mp4', sizeLabel: '18 MB' },
    pdf: { name: 'itinerary.pdf', contentType: PDF, sizeLabel: '184 kB' },
    longName: {
      name: 'quarterly-board-meeting-minutes-final-revised-v7.pdf',
      contentType: PDF,
      sizeLabel: '18.4 MB',
    },
    arabicName: { name: 'تقرير-الربع-الثالث.pdf', contentType: PDF, sizeLabel: '2 MB' },
  },
  render: (row) => <Tile {...row} index={0} />,
})

/** Mostly pictures, with a document every fourth tile, as a real pick tends to be. */
function trayTile(at: number): TileRow {
  if (at % 4 === 2)
    return { name: `notes-${String(at + 1)}.pdf`, contentType: PDF, sizeLabel: '184 kB' }
  return {
    name: `photo-${String(at + 1).padStart(2, '0')}.jpg`,
    contentType: 'image/jpeg',
    sizeLabel: '2.4 MB',
    picture: at,
  }
}

interface TrayRow {
  count: number
  startOffset?: number | undefined
}

function Tray({ count, startOffset }: TrayRow) {
  const tiles = Array.from({ length: count }, (_, at) => trayTile(at))
  return (
    <StagedTray
      countLabel={`${String(count)} / ${String(MAX_ATTACHMENTS_PER_MESSAGE)}`}
      countSpokenLabel={`${String(count)} of ${String(MAX_ATTACHMENTS_PER_MESSAGE)} attachments`}
      clearLabel="Clear"
      onClear={noop}
      addLabel="Add attachment"
      onAdd={count >= MAX_ATTACHMENTS_PER_MESSAGE ? undefined : noop}
      startOffset={startOffset}
      testID={ELEMENT.conversation.stagedTray}
      clearTestID={ELEMENT.conversation.stagedClear}
      addTestID={ELEMENT.conversation.stagedAdd}
    >
      {tiles.map((tile, at) => (
        <Tile key={tile.name} {...tile} index={at} />
      ))}
    </StagedTray>
  )
}

export const stagedTray = defineStory<TrayRow>({
  component: 'stagedTray',
  story: 'counts',
  width: 560,
  sensitive: { rtl: true, responsive: true },
  variants: {
    one: { count: 1 },
    three: { count: 3 },
    full: { count: MAX_ATTACHMENTS_PER_MESSAGE },
    overflowing: { count: 8 },
    // Past the start at every width the pages draw and short of the end, so both chevrons show.
    middle: { count: 16, startOffset: 720 },
  },
  render: (row) => <Tray {...row} />,
})

interface NoticeRow {
  message: string
  detail?: string | undefined
  detailName?: string | undefined
}

const TOO_LARGE: NoticeRow = {
  message: 'Files must be less than 10MB',
  detail: 'field-recording.wav · 48 MB',
  detailName: 'field-recording.wav',
}
const LONG_NAME = 'quarterly-board-meeting-minutes-final-revised-v7-with-appendices.pdf'
const OVER_LIMIT: NoticeRow = {
  message: `Unable to send more than ${String(MAX_ATTACHMENTS_PER_MESSAGE)} files at once.`,
  detail: '3 not added',
}

function Notices({ notices }: { notices: readonly NoticeRow[] }) {
  return (
    <YStack gap="$sm">
      {notices.map(({ message, detail, detailName }) => (
        <ComposerNotice
          key={message}
          message={message}
          detail={detail}
          detailName={detailName}
          onDismiss={noop}
          dismissLabel="Close"
          testID={ELEMENT.conversation.composerNotice('size')}
          dismissTestID={ELEMENT.conversation.composerNoticeDismiss('size')}
        />
      ))}
    </YStack>
  )
}

export const composerNotice = defineStory<{ notices: readonly NoticeRow[] }>({
  component: 'composerNotice',
  story: 'refusals',
  width: 420,
  sensitive: { rtl: true },
  variants: {
    tooLarge: { notices: [TOO_LARGE] },
    imageTooLarge: {
      notices: [
        {
          message: 'Image too large to send',
          detail: 'panorama.png · 9.1 MB',
          detailName: 'panorama.png',
        },
      ],
    },
    overLimit: { notices: [OVER_LIMIT] },
    unreadable: { notices: [{ message: 'Error attaching file' }] },
    longName: {
      notices: [
        {
          message: TOO_LARGE.message,
          detail: `${LONG_NAME} · 18.4 MB`,
          detailName: LONG_NAME,
        },
      ],
    },
    twoAtOnce: {
      notices: [{ ...TOO_LARGE, detail: `${TOO_LARGE.detail ?? ''}, and 2 more` }, OVER_LIMIT],
    },
  },
  render: (row) => <Notices {...row} />,
})

/** The overlay fills its parent: a conversation pane's height, roughly. */
const DROP_PANE_HEIGHT = 360

export const dropOverlay = defineStory<{ title: string; hint: string }>({
  component: 'dropOverlay',
  story: 'pane',
  width: 560,
  sensitive: { accent: true, responsive: true },
  variants: {
    titleAndHint: {
      title: 'Add attachment',
      hint: `Up to ${String(MAX_ATTACHMENTS_PER_MESSAGE)} files under ${formatBytes(10_000_000)}; pictures are shrunk to fit`,
    },
  },
  render: (row) => (
    <YStack height={DROP_PANE_HEIGHT}>
      <DropOverlay {...row} testID={ELEMENT.conversation.dropOverlay} />
    </YStack>
  ),
})
