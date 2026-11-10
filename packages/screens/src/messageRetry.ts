import type { Message } from '@session/client'

import { isUploadPhase } from './uploadState'

/**
 * Which states are worth offering a retry for.
 *
 * `failed` and `interrupted` are worth another attempt - something was unreachable, or a picture
 * could not be read this time. `unsendable` is not: libsession keeps it apart precisely so a client
 * knows which failures to offer a retry for, and it means a file is gone or too large to send, so
 * retrying fails identically every time.
 */
const RETRYABLE: readonly Message['sendState'][] = ['failed', 'interrupted']

/**
 * Whether the message's own Retry is offered. A set still uploading has its Retry in the
 * attachment footer instead, beside the count it resumes.
 */
export function offersRetry(message: Message): boolean {
  return message.outgoing && RETRYABLE.includes(message.sendState) && !isUploadPhase(message)
}
