import { memoryPorts, setPorts } from '@session/app'
import type { NetworkName } from '@session/app'

/** Replaced at build time by electron.vite.config.ts, from the SESSION_NETID the main process reads. */
declare const __SESSION_NETID__: string

/** Only testnet is reachable today: the shim refuses devnet until it can be handed seed nodes. */
function netid(): NetworkName {
  return __SESSION_NETID__ === 'testnet' ? 'testnet' : 'mainnet'
}

/**
 * The desktop app's OS ports.
 *
 * Only the ones the walking skeleton needs are real; the rest are the memory
 * implementations, which do nothing rather than pretending. Each becomes an IPC call to the
 * main process as its screen arrives - file pickers and notifications live over there,
 * because that is where Electron's dialog and Notification are.
 */
setPorts(
  memoryPorts({
    network: { name: netid() },
    window: {
      isFocused: () => document.hasFocus(),
      onFocusChange: (handler) => {
        const onFocus = () => handler(true)
        const onBlur = () => handler(false)
        window.addEventListener('focus', onFocus)
        window.addEventListener('blur', onBlur)
        return () => {
          window.removeEventListener('focus', onFocus)
          window.removeEventListener('blur', onBlur)
        }
      },
    },
    clipboard: {
      setString: (value) => navigator.clipboard.writeText(value),
      getString: () => navigator.clipboard.readText(),
    },
  }),
)
