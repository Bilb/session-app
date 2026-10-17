/** Outlasts a picker or menu closing, whose screen change cuts off speech already under way. */
export const ANNOUNCE_SETTLE_MS = 700

export interface Speaker {
  announceForAccessibility: (text: string) => void
  announceForAccessibilityWithOptions: (text: string, options: { queue?: boolean }) => void
}

/**
 * Says `text` once the screen has settled, queued behind whatever VoiceOver is already saying.
 * Returns the cancel, for words overtaken before they were said.
 */
export function scheduleAnnouncement(text: string, os: string, speaker: Speaker): () => void {
  const timer = setTimeout(() => {
    if (os === 'ios') speaker.announceForAccessibilityWithOptions(text, { queue: true })
    else speaker.announceForAccessibility(text)
  }, ANNOUNCE_SETTLE_MS)
  return () => {
    clearTimeout(timer)
  }
}
