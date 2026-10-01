export interface ToastCardProps {
  text: string
  onPress: () => void
  /** Names the close cross for a screen reader, since it is drawn as a glyph. */
  closeLabel: string
  testID: string
  /** The control that dismisses the toast, for a test that cannot wait out its timer. */
  closeTestID: string
}
