export { createSessionClient } from './createSessionClient'
export { createNativeBridgeTransport } from './nativeTransport'
export type { NativeTransportOptions } from './nativeTransport.types'
export { BridgeClosedError, SessionClientError } from './errors'
export type {
  AccountInfo,
  Attachment,
  AttachmentProgress,
  AutoDownload,
  BridgeTransport,
  Conversation,
  ConversationId,
  ConversationKind,
  Deletion,
  Message,
  MessageCursor,
  OutgoingAttachment,
  OutgoingMessage,
  ProgressCallback,
  Reply,
  SendState,
  SessionClient,
  SessionEvent,
  Unsubscribe,
} from './types'
