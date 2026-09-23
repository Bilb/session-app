import type { Request } from '@session/bridge-types'

/**
 * The buffers to hand over rather than copy, which for now means the ones carrying a secret.
 *
 * `postMessage` structured-clones by default, so a recovery phrase would exist in this process and
 * in the main one, and the copy over there is the one this side can never reach to clear. Listing
 * the buffer **detaches** it: the bytes move, this side is left with an empty view, and the shim
 * zeroes them when it is done.
 *
 * Detaching is why this reads the command rather than scanning the request for anything binary --
 * handing over a buffer the sender still meant to read would empty it under them. Only fields the
 * protocol marks as a secret are given up, and the sender has no use for them afterwards.
 *
 * Its own module, and typed as `ArrayBuffer[]` rather than `Transferable[]`, so it carries no DOM
 * types: the desktop tests are checked as node and would otherwise drag the whole transport in
 * with them.
 */
export function secretBuffers(request: Request): ArrayBuffer[] {
  const command = request.command
  if (command.type !== 'restoreAccountFromWords' && command.type !== 'checkRecoveryPhrase') {
    return []
  }
  return [command.phrase.buffer as ArrayBuffer]
}
