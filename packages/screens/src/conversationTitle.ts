import type { Conversation } from '@session/client'

/**
 * As much of a conversation as naming it needs: its id, and whatever names it has yet.
 *
 * Partial so a screen that has the id and not the conversation — the moment a route opens one
 * the store has not hydrated — can ask the same question.
 */
type Named = Pick<Conversation, 'id'> & Partial<Pick<Conversation, 'nickname' | 'displayName'>>

/**
 * What to call a conversation on screen.
 *
 * A display name arrives with the other side's profile, and libsession reports an empty string
 * until it does — which the rows rendered faithfully as nothing at all: an avatar, a snippet
 * and no indication of who had written. The account ID is the one name that always exists.
 */
export function conversationTitle(conversation: Named): string {
  const named = conversation.nickname ?? conversation.displayName ?? ''
  return named.trim().length > 0 ? named : shortenAccountId(conversation.id)
}

/**
 * Both ends of an account ID, which is all of it anybody reads.
 *
 * The middle is what a row has no room for and what makes two IDs look alike; the ends are
 * what somebody compares against the ID shown on the other device.
 */
function shortenAccountId(id: string): string {
  return id.length <= 20 ? id : `${id.slice(0, 8)}…${id.slice(-6)}`
}
