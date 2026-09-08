import { netidForTransport, parseNetworkName } from '@session/basic-types'
import { createSessionClient, type BridgeTransport } from '@session/client'
import { createSessionStore } from '@session/state'
import { Platform } from 'react-native'

import { resolveDatabaseKey, sessionPaths } from './storage'

/**
 * The mobile client.
 *
 * The Nitro module is reached through `@session/client`'s `.native` pair rather than imported
 * here: an app is an adapter, and which bridge it gets is the one decision this file makes.
 */
async function openTransport(): Promise<BridgeTransport> {
  const netid = netidForTransport(parseNetworkName(process.env['EXPO_PUBLIC_SESSION_NETID']))

  // Metro inlines an env var into the bundle only when its name carries EXPO_PUBLIC_; a bare name
  // reads `undefined` here however the dev script was invoked. Drop the prefix and this check
  // falls through silently, taking the Nitro module and real libsession on a run meant to be fake.
  if (process.env['EXPO_PUBLIC_SESSION_FAKE'] === '1') {
    const { createFakeBridge } = await import('./dev/fakeBridge')
    return createFakeBridge()
  }

  const { createNativeBridgeTransport } = await import('@session/client')
  const paths = await sessionPaths()

  return createNativeBridgeTransport({
    ...paths,
    rawKeyHex: await resolveDatabaseKey(),
    // Onboarding has to be asked. Without this libsession creates an account as the database
    // opens, and the first screen is a conversation list for an identity nobody chose.
    deferAccount: true,
    // Attached by the bridge once an account exists: on open if there is one already, and
    // after onboarding otherwise.
    // Unset means mainnet, and absent for devnet, which attaches nothing rather than quietly
    // attaching mainnet. See netidForTransport.
    ...(netid === undefined ? {} : { netid }),
    deviceType: Platform.OS === 'ios' ? 'ios' : 'android',
  })
}

export const storePromise = openTransport().then((transport) =>
  createSessionStore(createSessionClient(transport), {
    // Reaches logcat as ReactNativeJS on Android, and the device console on iOS.
    log: (level, line) => {
      console[level](line)
    },
  }),
)
