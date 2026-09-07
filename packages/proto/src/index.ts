/**
 * The bridge wire format.
 *
 * Generated code lives in src/gen and is committed: CI regenerates and fails on a diff, so
 * what you read here is what the shim was compiled against.
 */

export * from './gen/sessionbridge/v1/types_pb'
export * from './gen/sessionbridge/v1/commands_pb'
export * from './gen/sessionbridge/v1/frames_pb'

/**
 * Attachment transfer results that libsession originates itself, rather than passing on
 * from the file server. Everything else in `AttachmentProgress.result` is either a file
 * server HTTP status or a negative network code.
 *
 * Zero always means accepted - and is the only value that means done.
 */
export const ATTACHMENT_OK = 0
export const ATTACHMENT_FILE_MISSING = -20001
export const ATTACHMENT_UNREADABLE = -20002
