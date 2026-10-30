import { ALBUM_SIZES, ALBUM_WIDTH } from '@session/basic-types'
import { ELEMENT } from '@session/test-ids'

import { AttachmentAlbum, type AlbumItem } from '../../AttachmentAlbum'
import { defineStory } from '../story'
import { MESSAGE_FRAME_INSET_PX, MessageFrame } from '../../MessageFrame'
import { noop } from './shared'

/** A desktop bubble, wider than the phone's album. */
const DESKTOP_ALBUM_WIDTH = ALBUM_SIZES.desktop.maxWidthPx
/** A phone's widest album, three quarters of a 430 pt transcript. */
const PHONE_ALBUM_MAX_WIDTH = ALBUM_SIZES.mobile.maxWidthPx
/** The desktop's cap on a picture alone. */
const DESKTOP_LONE_MAX_HEIGHT_PX = ALBUM_SIZES.desktop.loneMaxHeightPx

const SQUARE = 1
const PORTRAIT = 3 / 4
const LANDSCAPE = 4 / 3
const PHONE = 9 / 16
const ULTRAWIDE = 21 / 9
const ULTRATALL = 9 / 21
const PANORAMA = 3
const HALF = 1 / 2
const NEEDLE = 1 / 5
const PANORAMA_WIDE = 5

/**
 * Placeholders, with no picture to fetch: what is drawn here is the tiles' rects and rings. An
 * `undefined` shape is a picture whose sender gave no dimensions.
 */
const tiles = (aspects: readonly (number | undefined)[]): AlbumItem[] =>
  aspects.map((aspect, at) => ({ label: `${String(at + 1)}.jpg`, hint: 'Open', aspect }))

interface AlbumStory {
  aspects: readonly (number | undefined)[]
  onAccent: boolean
  width?: number | undefined
  loneMaxHeightPx?: number | undefined
}

function Album({ aspects, onAccent, width = ALBUM_WIDTH, loneMaxHeightPx }: AlbumStory) {
  return (
    <AttachmentAlbum
      items={tiles(aspects)}
      width={width}
      overflowLabel={(more) => `+${String(more)}`}
      overflowName={(label, more) => `${label} and ${String(more)} more`}
      onOpen={noop}
      fetchLabel="Download"
      fetchTestID={ELEMENT.conversation.attachmentFetch}
      tileTestID={ELEMENT.conversation.attachmentTile}
      onAccent={onAccent}
      loneMaxHeightPx={loneMaxHeightPx}
      testID={ELEMENT.conversation.attachment}
    />
  )
}

const inFrame = (props: AlbumStory) => (
  <MessageFrame outgoing={props.onAccent}>
    <Album {...props} />
  </MessageFrame>
)

/** Each tile's focus ring, inside the seam so the next tile does not paint over it. */
export const albumFocus = defineStory<AlbumStory>({
  component: 'album',
  story: 'focus',
  width: ALBUM_WIDTH + 2 * MESSAGE_FRAME_INSET_PX,
  forced: ['focus'],
  sensitive: { accent: true },
  variants: {
    three: { aspects: [PORTRAIT, LANDSCAPE, SQUARE], onAccent: false },
    five: { aspects: [PORTRAIT, LANDSCAPE, SQUARE, ULTRAWIDE, PORTRAIT], onAccent: false },
    threeOnAccent: { aspects: [PORTRAIT, LANDSCAPE, SQUARE], onAccent: true },
  },
  render: inFrame,
})

/**
 * One picture at its own shape: as wide as the album from 21:9 to a camera's 3:4 portrait, then
 * that tall and narrower down to 9:21, and cropped only past those.
 */
export const albumLone = defineStory<AlbumStory>({
  component: 'album',
  story: 'lone',
  width: DESKTOP_ALBUM_WIDTH + 2 * MESSAGE_FRAME_INSET_PX,
  variants: {
    square: { aspects: [SQUARE], onAccent: false },
    landscape: { aspects: [LANDSCAPE], onAccent: false },
    portrait: { aspects: [PORTRAIT], onAccent: false },
    phoneScreenshot: { aspects: [PHONE], onAccent: false },
    veryTall: { aspects: [ULTRATALL], onAccent: false },
    veryWide: { aspects: [PANORAMA], onAccent: false },
    noDimensions: { aspects: [undefined], onAccent: false },
    onAccent: { aspects: [LANDSCAPE], onAccent: true },
    // At a phone's widest album, and at the desktop's, where the 460 px cap narrows a portrait.
    phoneScreenshotWidestPhone: { aspects: [PHONE], onAccent: false, width: PHONE_ALBUM_MAX_WIDTH },
    portraitDesktop: {
      aspects: [PORTRAIT],
      onAccent: false,
      width: DESKTOP_ALBUM_WIDTH,
      loneMaxHeightPx: DESKTOP_LONE_MAX_HEIGHT_PX,
    },
    phoneScreenshotDesktop: {
      aspects: [PHONE],
      onAccent: false,
      width: DESKTOP_ALBUM_WIDTH,
      loneMaxHeightPx: DESKTOP_LONE_MAX_HEIGHT_PX,
    },
  },
  render: inFrame,
})

/**
 * Several pictures in justified rows: each row fills the width at one height, every tile at its
 * picture's shape where that fits, in the sender's order.
 */
export const albumRows = defineStory<AlbumStory>({
  component: 'album',
  story: 'rows',
  width: DESKTOP_ALBUM_WIDTH + 2 * MESSAGE_FRAME_INSET_PX,
  sensitive: { rtl: true },
  variants: {
    twoSquares: { aspects: [SQUARE, SQUARE], onAccent: false },
    twoLandscapes: { aspects: [LANDSCAPE, LANDSCAPE], onAccent: false },
    portraitAndLandscape: { aspects: [PORTRAIT, LANDSCAPE], onAccent: false },
    threeMixed: { aspects: [PORTRAIT, LANDSCAPE, SQUARE], onAccent: false },
    fourLandscapes: { aspects: [LANDSCAPE, LANDSCAPE, LANDSCAPE, LANDSCAPE], onAccent: false },
    fourExtremes: { aspects: [PHONE, PANORAMA, HALF, ULTRAWIDE], onAccent: false },
    fiveMixed: { aspects: [PORTRAIT, LANDSCAPE, SQUARE, ULTRAWIDE, ULTRATALL], onAccent: false },
    fiveUltrawide: {
      aspects: [ULTRAWIDE, ULTRAWIDE, ULTRAWIDE, ULTRAWIDE, ULTRAWIDE],
      onAccent: false,
    },
    someWithoutDimensions: { aspects: [undefined, LANDSCAPE, undefined], onAccent: false },
    fiveMixedOnAccent: {
      aspects: [PORTRAIT, LANDSCAPE, SQUARE, ULTRAWIDE, ULTRATALL],
      onAccent: true,
    },
    fiveMixedDesktop: {
      aspects: [PORTRAIT, LANDSCAPE, SQUARE, ULTRAWIDE, ULTRATALL],
      onAccent: false,
      width: DESKTOP_ALBUM_WIDTH,
    },
  },
  render: inFrame,
})

/** iPhone and Android screenshots. */
const IPHONE_SHAPE = 9 / 19.5
const ANDROID_SHAPE = 9 / 20

/**
 * "+N" past five: a square slot over the next picture's ThumbHash, never alone on its row and
 * never the largest tile, on the sets where that is hardest - the count's picture the widest,
 * all panoramas, all phone screenshots, and the cases a seeded sweep found nearest the largest.
 */
export const albumOverflow = defineStory<AlbumStory>({
  component: 'album',
  story: 'overflow',
  width: DESKTOP_ALBUM_WIDTH + 2 * MESSAGE_FRAME_INSET_PX,
  sensitive: { rtl: true },
  variants: {
    // Five, and the same five with one more: the fifth tile turns into the count.
    fiveMixed: { aspects: [PORTRAIT, LANDSCAPE, SQUARE, ULTRAWIDE, ULTRATALL], onAccent: false },
    fiveMixedPlusOne: {
      aspects: [PORTRAIT, LANDSCAPE, SQUARE, ULTRAWIDE, ULTRATALL, LANDSCAPE],
      onAccent: false,
    },
    eightMixed: {
      aspects: [PANORAMA, HALF, SQUARE, PORTRAIT, LANDSCAPE, ULTRAWIDE, ULTRATALL, PHONE],
      onAccent: false,
    },
    portraitFirst: {
      aspects: [PORTRAIT, LANDSCAPE, LANDSCAPE, LANDSCAPE, LANDSCAPE, LANDSCAPE],
      onAccent: false,
    },
    afterNeedles: {
      aspects: [NEEDLE, NEEDLE, NEEDLE, NEEDLE, PANORAMA_WIDE, LANDSCAPE, LANDSCAPE],
      onAccent: false,
    },
    wideLast: {
      aspects: [PORTRAIT, PORTRAIT, PORTRAIT, PORTRAIT, ULTRAWIDE, SQUARE, SQUARE],
      onAccent: false,
    },
    smallOverSquare: {
      aspects: [IPHONE_SHAPE, PORTRAIT, IPHONE_SHAPE, SQUARE, PORTRAIT, SQUARE, SQUARE],
      onAccent: false,
    },
    widePairThenPhones: {
      aspects: [3 / 2, 16 / 9, SQUARE, IPHONE_SHAPE, ANDROID_SHAPE, SQUARE, SQUARE],
      onAccent: false,
    },
    panoramas: { aspects: Array<number>(7).fill(PANORAMA_WIDE), onAccent: false },
    phones: { aspects: Array<number>(7).fill(IPHONE_SHAPE), onAccent: false },
    phonesDesktop: {
      aspects: Array<number>(7).fill(IPHONE_SHAPE),
      onAccent: false,
      width: DESKTOP_ALBUM_WIDTH,
    },
    onAccent: {
      aspects: [PORTRAIT, LANDSCAPE, SQUARE, ULTRAWIDE, ULTRATALL, LANDSCAPE],
      onAccent: true,
    },
  },
  render: inFrame,
})
