export interface ToastHostProps {
  /** On every toast; the same id for each, so a test addresses them as a list. */
  testID: string
  /** On each toast's close cross, so a test can clear one without waiting it out. */
  closeTestID: string
  /** Names the close cross for a screen reader, since it is drawn as a glyph. */
  closeLabel: string
}
