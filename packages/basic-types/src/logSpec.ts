/**
 * How much of libsession's own logging to forward, per category.
 *
 * A single level is a firehose: `quic` and `session-router` alone produce thousands of lines a
 * second at debug, which buries the handful that answer a question and, once there is a log buffer
 * to export, fills it with seconds of the wrong history.
 */
/** Structurally identical to `@session/bridge-types`' own, which this package may not import. */
export type LibsessionLogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'critical'

/** One category turned up or down, on top of the default. */
export interface LogCategoryLevel {
  category: string
  level: LibsessionLogLevel
}

export interface LogSpec {
  /** Applied to every category first, so the pairs below are overrides rather than the whole set. */
  level?: LibsessionLogLevel
  categories: LogCategoryLevel[]
  /**
   * Names that are not in `KNOWN_LOG_CATEGORIES`.
   *
   * Reported rather than refused: the list below cannot be exhaustive, since a dependency can
   * declare a category this package has never heard of. But a typo creates a logger that matches
   * nothing and fails silently, so a caller should say which names it did not recognise.
   */
  unknown: string[]
}

const LEVELS: readonly string[] = ['trace', 'debug', 'info', 'warn', 'error', 'critical']

/**
 * The categories libsession and its transports actually declare.
 *
 * Advisory, not authoritative - it is what `log::Cat(...)` names across libsession-util,
 * oxen-libquic and session-router, read off the source because no API enumerates them. A run at
 * flat debug turned up eleven this list had missed, all of them the router's, which is why it is
 * reported rather than enforced.
 */
export const KNOWN_LOG_CATEGORIES: readonly string[] = [
  'address',
  'apple.ctx_wrapper',
  'apple.route_manager',
  'auth_policy',
  'bootstrap',
  'client',
  'client-intro',
  'config',
  'config.def',
  'config.ini',
  'configs',
  'contactdb',
  'context',
  'core',
  'core.dev',
  'core.gbl',
  'crypto',
  'daemon',
  'deadlock',
  'direct-router',
  'dns',
  'ev-loop',
  'ev-tcp',
  'ev.fd',
  'full',
  'gnutls',
  'ip_packet',
  'iprange',
  'keymanager',
  'keys',
  'libsessionrouter',
  'link.endpoint',
  'link.manager',
  'link_conn',
  'manual',
  'network',
  'nodedb',
  'onion-request-router',
  'packet_router',
  'path',
  'pathctx',
  'pathhandler',
  'posix',
  'profiling',
  'quic',
  'quic-file-client',
  'quic-transport',
  'relay-contact',
  'request_queue',
  'route_poker',
  'router',
  'rpc-controller',
  'RPC-conversions',
  'rpc-server',
  'rpc.auth',
  'rpc.oxend',
  'schema',
  'session',
  'session-router',
  'session_ep',
  'snode_pool',
  'svc',
  'testing',
  'TrafficPolicy',
  'transit-hop',
  'tun',
  'util.file',
  'util.threading',
  'vpn.linux',
  'win32-dll',
  'win32.net',
  'win32:exec',
  'windivert',
  'wintun',
]

function level(value: string): LibsessionLogLevel | undefined {
  return LEVELS.includes(value) ? (value as LibsessionLogLevel) : undefined
}

/**
 * Reads `warn,network=debug,client=debug` into a default and its overrides.
 *
 * A bare level anywhere sets the default; `category=level` pairs override it. Order in the string
 * does not matter, because the default is applied to every category before the overrides are.
 *
 * Anything unreadable is dropped rather than throwing: this comes from a `.env` a person edits,
 * and refusing to start over a typo in a diagnostic setting is worse than starting without it.
 * `unknown` is how a caller reports what it ignored.
 */
export function parseLogSpec(value: string | undefined): LogSpec | undefined {
  const parts = (value ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
  if (parts.length === 0) return undefined

  const spec: LogSpec = { categories: [], unknown: [] }

  for (const part of parts) {
    const eq = part.indexOf('=')
    if (eq === -1) {
      const bare = level(part)
      if (bare !== undefined) spec.level = bare
      else spec.unknown.push(part)
      continue
    }

    const name = part.slice(0, eq).trim()
    const wanted = level(part.slice(eq + 1).trim())
    if (name.length === 0 || wanted === undefined) {
      spec.unknown.push(part)
      continue
    }
    if (!KNOWN_LOG_CATEGORIES.includes(name)) spec.unknown.push(name)
    spec.categories.push({ category: name, level: wanted })
  }

  return spec.level === undefined && spec.categories.length === 0 && spec.unknown.length === 0
    ? undefined
    : spec
}
