import { ALBUM_SIZES, ALBUM_WIDTH } from '@session/basic-types'
import { ELEMENT } from '@session/test-ids'

import { AttachmentAlbum, type AlbumItem } from '../../AttachmentAlbum'
import {
  ANDROID_SCREEN,
  HALF,
  IPHONE_SCREEN,
  LANDSCAPE,
  NEEDLE,
  PANORAMA,
  PANORAMA_WIDE,
  PHONE,
  PORTRAIT,
  SQUARE,
  ULTRATALL,
  ULTRAWIDE,
  WIDESCREEN,
} from '../albumShapes'
import { defineStory } from '../story'
import { MESSAGE_FRAME_INSET_PX, MessageFrame } from '../../MessageFrame'
import { noop } from './shared'

/** The wide layout's widest album: list and conversation side by side. */
const WIDE_ALBUM_MAX_WIDTH = ALBUM_SIZES.wide.maxWidthPx
/** The narrow layout's widest album, three quarters of a 430 pt transcript. */
const NARROW_ALBUM_MAX_WIDTH = ALBUM_SIZES.narrow.maxWidthPx
/** The wide layout's cap on a picture alone. */
const WIDE_LONE_MAX_HEIGHT_PX = ALBUM_SIZES.wide.loneMaxHeightPx

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
  // Aligned as the transcript aligns it, so the bubble hugs the album rather than filling a cell
  // sized for the story's widest row.
  <MessageFrame outgoing={props.onAccent} alignSelf={props.onAccent ? 'flex-end' : 'flex-start'}>
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
  width: WIDE_ALBUM_MAX_WIDTH + 2 * MESSAGE_FRAME_INSET_PX,
  variants: {
    square: { aspects: [SQUARE], onAccent: false },
    landscape: { aspects: [LANDSCAPE], onAccent: false },
    portrait: { aspects: [PORTRAIT], onAccent: false },
    phoneScreenshot: { aspects: [PHONE], onAccent: false },
    veryTall: { aspects: [ULTRATALL], onAccent: false },
    veryWide: { aspects: [PANORAMA], onAccent: false },
    noDimensions: { aspects: [undefined], onAccent: false },
    onAccent: { aspects: [LANDSCAPE], onAccent: true },
    // At the narrow layout's widest album, and at the wide layout's, where its 460 px cap narrows
    // a portrait.
    phoneScreenshotNarrowWidest: {
      aspects: [PHONE],
      onAccent: false,
      width: NARROW_ALBUM_MAX_WIDTH,
    },
    portraitWide: {
      aspects: [PORTRAIT],
      onAccent: false,
      width: WIDE_ALBUM_MAX_WIDTH,
      loneMaxHeightPx: WIDE_LONE_MAX_HEIGHT_PX,
    },
    phoneScreenshotWide: {
      aspects: [PHONE],
      onAccent: false,
      width: WIDE_ALBUM_MAX_WIDTH,
      loneMaxHeightPx: WIDE_LONE_MAX_HEIGHT_PX,
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
  width: WIDE_ALBUM_MAX_WIDTH + 2 * MESSAGE_FRAME_INSET_PX,
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
    fiveMixedWide: {
      aspects: [PORTRAIT, LANDSCAPE, SQUARE, ULTRAWIDE, ULTRATALL],
      onAccent: false,
      width: WIDE_ALBUM_MAX_WIDTH,
    },
  },
  render: inFrame,
})

/**
 * "+N" past five: a square slot over the next picture's ThumbHash, never alone on its row and
 * never the largest tile, on the sets where that is hardest - the count's picture the widest,
 * all panoramas, all phone screenshots, and the cases a seeded sweep found nearest the largest.
 */
export const albumOverflow = defineStory<AlbumStory>({
  component: 'album',
  story: 'overflow',
  width: WIDE_ALBUM_MAX_WIDTH + 2 * MESSAGE_FRAME_INSET_PX,
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
      aspects: [IPHONE_SCREEN, PORTRAIT, IPHONE_SCREEN, SQUARE, PORTRAIT, SQUARE, SQUARE],
      onAccent: false,
    },
    widePairThenPhones: {
      aspects: [3 / 2, WIDESCREEN, SQUARE, IPHONE_SCREEN, ANDROID_SCREEN, SQUARE, SQUARE],
      onAccent: false,
    },
    panoramas: { aspects: Array<number>(7).fill(PANORAMA_WIDE), onAccent: false },
    phones: { aspects: Array<number>(7).fill(IPHONE_SCREEN), onAccent: false },
    phonesWide: {
      aspects: Array<number>(7).fill(IPHONE_SCREEN),
      onAccent: false,
      width: WIDE_ALBUM_MAX_WIDTH,
    },
    onAccent: {
      aspects: [PORTRAIT, LANDSCAPE, SQUARE, ULTRAWIDE, ULTRATALL, LANDSCAPE],
      onAccent: true,
    },
  },
  render: inFrame,
})

/**
 * What the layout chooses where two layouts fit, one row each: two landscapes from 1.3:1 stacked
 * and squarer pairs side by side; a grid never flattened into a strip; "+N" kept out of the two
 * largest tiles; a lopsided set balanced; a strip of screenshot slivers made a grid at the
 * narrowest album, but never by cropping more than the nearest fit would. The worst case is the
 * tallest grid it keeps, screenshots at half again the width with their tops cropped.
 */
export const albumChoices = defineStory<AlbumStory>({
  component: 'album',
  story: 'choices',
  width: WIDE_ALBUM_MAX_WIDTH + 2 * MESSAGE_FRAME_INSET_PX,
  sensitive: { rtl: true },
  variants: {
    landscapePairStacked: {
      aspects: [LANDSCAPE, LANDSCAPE],
      onAccent: false,
      width: NARROW_ALBUM_MAX_WIDTH,
    },
    nearSquarePairSideBySide: {
      aspects: [5 / 4, 5 / 4],
      onAccent: false,
      width: NARROW_ALBUM_MAX_WIDTH,
    },
    squarestLandscapePair: {
      aspects: [1.04, 1.04],
      onAccent: false,
      width: NARROW_ALBUM_MAX_WIDTH,
    },
    fourPortraitsKeptGrid: {
      aspects: [PORTRAIT, PORTRAIT, PORTRAIT, PORTRAIT],
      onAccent: false,
      width: NARROW_ALBUM_MAX_WIDTH,
    },
    countOutOfTopTwo: {
      aspects: [PORTRAIT, PORTRAIT, PORTRAIT, LANDSCAPE, LANDSCAPE, LANDSCAPE, LANDSCAPE],
      onAccent: false,
      width: NARROW_ALBUM_MAX_WIDTH,
    },
    lopsidedBalanced: {
      aspects: [WIDESCREEN, PORTRAIT, PORTRAIT, WIDESCREEN],
      onAccent: false,
      width: WIDE_ALBUM_MAX_WIDTH,
    },
    screenshotStripAsGrid: {
      aspects: [IPHONE_SCREEN, PORTRAIT, PORTRAIT, IPHONE_SCREEN, IPHONE_SCREEN],
      onAccent: false,
    },
    sliverKeptUncropped: {
      aspects: [LANDSCAPE, PORTRAIT, LANDSCAPE, LANDSCAPE, LANDSCAPE],
      onAccent: false,
    },
    tallestKeptGrid: {
      aspects: [IPHONE_SCREEN, IPHONE_SCREEN, IPHONE_SCREEN, PORTRAIT, 2 / 3, IPHONE_SCREEN],
      onAccent: false,
      width: WIDE_ALBUM_MAX_WIDTH,
    },
  },
  render: inFrame,
})
