import { addressShape, renderAddress } from './address'
import type { Pseudonyms } from './pseudonym'

/**
 * Session's own public infrastructure, which identifies nobody and so is written in clear.
 *
 * Any host not listed is a pseudonym: a community server says which communities somebody is in.
 * The official community's host is deliberately absent - its room names would show.
 */
const PUBLIC_HOSTS: ReadonlySet<string> = new Set([
  'getsession.org',
  'docs.getsession.org',
  'token.getsession.org',
  'seed1.getsession.org',
  'seed2.getsession.org',
  'seed3.getsession.org',
  'filev2.getsession.org',
  'push.getsession.org',
  // libsession's testnet file server: `TESTNET_CONFIG` in network/backends/session_file_server.cpp.
  'superduperfiles.oxen.io',
])

/** Path words of the community and file server APIs, which carry no identity of their own. */
const PATH_WORDS: ReadonlySet<string> = new Set([
  'room',
  'rooms',
  'file',
  'files',
  'message',
  'messages',
  'since',
  'before',
  'recent',
  'capabilities',
  'batch',
  'sequence',
  'pin',
  'unpin',
  'reactions',
  'reaction',
  'reactors',
  'inbox',
  'outbox',
  'poll',
  'info',
  'user',
  'oxen',
  'session_version',
  'lsrpc',
  'json_rpc',
  'storage_rpc',
  'v1',
  'v2',
  'v3',
  'v4',
  'onion_req',
])

/** Long enough, and of the right alphabet, to be a key, a hash or a server-assigned id. */
function looksLikeId(segment: string): boolean {
  return (
    /^[0-9a-f]{16,}$/i.test(segment) ||
    /^[A-Za-z0-9+/_=-]{20,}$/.test(segment) ||
    /^\d{6,}$/.test(segment)
  )
}

const URL_PATTERN = /^([a-z][a-z0-9+.-]*):\/\/([^/?#\s]*)([^?#\s]*)(\?[^#\s]*)?(#\S*)?$/i

function renderHost(authority: string, pseudonyms: Pseudonyms): string {
  const hostPort = authority.replace(/^[^@]*@/, '')
  const bracketed = /^(\[[^\]]+\])(?::(\d+))?$/.exec(hostPort)
  const [host, port] =
    bracketed === null
      ? ((): [string, string | undefined] => {
          const at = hostPort.lastIndexOf(':')
          return at === -1 ? [hostPort, undefined] : [hostPort.slice(0, at), hostPort.slice(at + 1)]
        })()
      : [bracketed[1] ?? '', bracketed[2]]
  if (addressShape(host) !== undefined) return `<${renderAddress(host, port)}>`
  const lower = host.toLowerCase()
  const name = PUBLIC_HOSTS.has(lower) ? lower : pseudonyms.of(lower)
  return port === undefined ? name : `${name}:${port}`
}

/**
 * A URL with its shape kept and what identifies taken out.
 *
 * `https://~a91f0c1d/room/~e02d4baf/messages/since/~41f0aade?<1>`: the scheme as is; the host in
 * clear only if it is Session's own; on Session's hosts the id-like path segments become
 * pseudonyms, and elsewhere every segment does but the API's own words; a query is replaced by how
 * many parameters it had, because a community link's public key travels there; a fragment is
 * dropped.
 * Credentials before the host are dropped without a trace.
 *
 * Undefined when the text is not a URL, so a caller can fall back to treating it as free text.
 */
export function renderUrl(text: string, pseudonyms: Pseudonyms): string | undefined {
  const match = URL_PATTERN.exec(text)
  if (match === null) return undefined
  const [, scheme = '', authority = '', path = '', query] = match
  const host = renderHost(authority, pseudonyms)
  const isPublic = PUBLIC_HOSTS.has(host.replace(/:\d+$/, ''))

  const segments = path.split('/').map((segment) => {
    if (segment === '') return segment
    if (isPublic) return looksLikeId(segment) ? pseudonyms.of(segment) : segment
    return PATH_WORDS.has(segment.toLowerCase()) ? segment : pseudonyms.of(segment)
  })

  const params =
    query === undefined
      ? 0
      : query
          .slice(1)
          .split('&')
          .filter((part) => part !== '').length
  const queryShape = query === undefined ? '' : `?<${String(params)}>`
  return `${scheme.toLowerCase()}://${host}${segments.join('/')}${queryShape}`
}
