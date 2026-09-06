/**
 * libsession reports failures as text - usually SQLite's own message. We keep the message
 * verbatim rather than mapping it onto codes we invented: the original says which
 * constraint failed, and a code would throw that away.
 */
export class SessionClientError extends Error {
  override readonly name = 'SessionClientError'

  constructor(message: string) {
    super(message)
  }
}

/**
 * Thrown at every promise still waiting when the client closes.
 *
 * libsession's own contract is that a handler runs exactly once "unless the Client is
 * destroyed first"; rejecting here is how that exception stays visible in TypeScript
 * instead of becoming a promise that never settles.
 */
export class BridgeClosedError extends Error {
  override readonly name = 'BridgeClosedError'

  constructor() {
    super('The session client was closed before this request completed')
  }
}
