import { requirePorts } from '@session/app'
import { tr } from '@session/localization'
import { useToast } from '@session/ui'

/**
 * Copies, and says so with a toast where the OS does not.
 *
 * Android 13 and later confirm a copy with their own clipboard preview, and a toast as well would
 * say it twice -- which is what `confirmsCopy` reports, and why every copy that toasts goes
 * through here rather than deciding for itself.
 */
export function useCopyWithToast(): (text: string) => void {
  const toasts = useToast()
  return (text) => {
    const clipboard = requirePorts().clipboard
    void clipboard.setString(text).then(() => {
      // One id for every copy, so copying twice shows the toast again rather than two of them.
      if (!clipboard.confirmsCopy) toasts.show(tr('copied'), { id: 'copied-to-clipboard' })
    })
  }
}
