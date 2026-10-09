import { parseNetworkName, parseRouterKind } from '@session/basic-types'

/**
 * The settings a run's network was chosen by, raw, as each app reads them from its environment.
 *
 * Read where the bridge is opened rather than from the network port, so the startup block says
 * what this run is attached to even where a build-time value and a runtime one could differ - a
 * desktop dev build, whose renderer's values are substituted when it is built.
 */
export interface NetworkSettings {
  fake: boolean
  netid: string | undefined
  router: string | undefined
  devnetSeedUrl: string | undefined
  fileServerUrl: string | undefined
  logSpec: string | undefined
}

const ROUTER_NAMES = {
  'onion-requests': 'onion requests',
  'session-router': 'Session Router',
  direct: 'Direct Router',
}

/**
 * The startup block's network rows: which network, which transport and whether it was chosen or
 * defaulted, then any further setting that was given. A setting added to the bridge belongs here,
 * so the block keeps saying everything a run was configured with.
 */
export function networkRows(settings: NetworkSettings): {
  network: string
  transport: string | null
  networkSettings: (readonly [string, string])[]
  logSpec: string
} {
  const logSpec =
    settings.logSpec === undefined || settings.logSpec === ''
      ? "libsession's default"
      : settings.logSpec
  if (settings.fake) {
    return { network: 'fake (no libsession)', transport: null, networkSettings: [], logSpec }
  }
  const name = parseNetworkName(settings.netid)
  const chosen = parseRouterKind(settings.router)
  // libsession's own default: Session Router on the public networks, onion requests on a devnet.
  const router = chosen ?? (name === 'devnet' ? 'onion-requests' : 'session-router')
  const extra: (readonly [string, string])[] = []
  if (settings.devnetSeedUrl) extra.push(['Seed node', settings.devnetSeedUrl])
  if (settings.fileServerUrl) extra.push(['File server', settings.fileServerUrl])
  return {
    network: name,
    transport: `${ROUTER_NAMES[router]} (${chosen === undefined ? 'default' : 'set'})`,
    networkSettings: extra,
    logSpec,
  }
}
