import type { NetworkStatus } from '@session/client'
import { tr } from '@session/localization'
import type { StatusTone } from '@session/ui'

import { PENDING_COPY } from './pendingCopy'

/**
 * The onion path's dot, from the network's status: green with a path, amber while one is being
 * built, red with none, grey before anything has reported.
 *
 * libsession reports one status for the whole network rather than the legacy desktop's count of
 * paths, so there is no amber for "only one path": amber is connecting, as on legacy iOS.
 */
export function pathStatusTone(status: NetworkStatus): StatusTone {
  switch (status) {
    case 'connected':
      return 'positive'
    case 'connecting':
      return 'warning'
    case 'disconnected':
      return 'danger'
    case 'unknown':
      return 'neutral'
  }
}

/** The state in words, which every dot is drawn beside. */
export function pathStatusLabel(status: NetworkStatus): string {
  switch (status) {
    case 'connected':
      return PENDING_COPY.onionRoutingPathConnected
    case 'connecting':
      return PENDING_COPY.onionRoutingPathConnecting
    case 'disconnected':
      return PENDING_COPY.onionRoutingPathOffline
    case 'unknown':
      return tr('unknown')
  }
}
