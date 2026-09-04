import type { BridgeTransport } from './types'
import type { NativeTransportOptions } from './nativeTransport.types'

export type { NativeTransportOptions }

/**
 * There is no native bridge outside the mobile app.
 *
 * The desktop app reaches libsession through the addon in its main process, and everything
 * else — tests, the node build of a shared package — has the fake. This exists so that the
 * import resolves everywhere and fails where it should, rather than resolving to a Nitro
 * module that is not there.
 */
export function createNativeBridgeTransport(_options: NativeTransportOptions): BridgeTransport {
  throw new Error(
    'The Nitro bridge is the mobile app only. Desktop loads @session/bridge-node in its main process.',
  )
}
