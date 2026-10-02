import type { ElementId } from '@session/test-ids'

export interface ToastCardProps {
  text: string
  onPress: () => void
  /** Names the close cross for a screen reader, since it is drawn as a glyph. */
  closeLabel: string
  testID: ElementId
  /** The control that dismisses the toast, for a test that cannot wait out its timer. */
  closeTestID: ElementId
}
