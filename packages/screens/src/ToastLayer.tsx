import { tr } from '@session/localization'
import { ELEMENT } from '@session/test-ids'
import { ToastHost } from '@session/ui'

/** The toasts, with their test id named here rather than by each app, as `ModalHost` does. */
export function ToastLayer() {
  return <ToastHost testID={ELEMENT.toast.item} closeLabel={tr('close')} />
}
