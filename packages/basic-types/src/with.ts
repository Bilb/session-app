import type { AbortSignalLike } from './cancellation'

export type WithSnodeEd25519 = { snodeEd25519: string }
export type WithSwarmStr = { swarm: string }

export type WithAbortSignal = { abortSignal: AbortSignalLike }
export type WithCiphertext = { ciphertext: Uint8Array }
export type WithHeaders = { headers: Record<string, string> }
export type WithHeadersMixed = { headers: Record<string, string | number> }

export type WithMessageHash = { messageHash: string }
export type WithMessageHashOrNull = { messageHash: string | null }
export type WithPlaintext = { plaintext: Uint8Array }
export type WithServerId = { serverId: number }
export type WithProBackendPubkeyHex = { proBackendPubkeyHex: string }
export type WithEnvelopePayload = { envelopePayload: Uint8Array }
export type WithSenderEd25519Seed = { senderEd25519Seed: Uint8Array }
export type WithSentTimestampMs = { sentTimestampMs: number }
