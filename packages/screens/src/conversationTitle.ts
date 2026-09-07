import type { Conversation } from '@session/client'

/**
 * As much of a conversation as naming it needs: its id, and whatever names it has yet.
 *
 * Partial so a screen that has the id and not the conversation - the moment a route opens one
 * the store has not hydrated - can ask the same question.
 */
type Named = Pick<Conversation, 'id'> & Partial<Pick<Conversation, 'nickname' | 'displayName'>>

/**
 * What to call a conversation on screen.
 *
 * Nickname, then display name, then the account ID, and a name that is only whitespace counts
 * as no name at all. libsession reports an empty string for a display name until the other
 * side's profile arrives, and a nickname set to blanks is a name nobody can read - both used to
 * render as an avatar, a snippet and no indication of who had written.
 *
 * The trimmed value is what comes back, since the untrimmed one is only ever leading space in a
 * row that has already been laid out.
 */
export function conversationTitle(conversation: Named): string {
  const nickname = conversation.nickname?.trim() ?? ''
  if (nickname.length > 0) return nickname

  const displayName = conversation.displayName?.trim() ?? ''
  if (displayName.length > 0) return displayName

  return shortenAccountId(conversation.id)
}

/**
 * Both ends of an account ID, which is all of it anybody reads.
 *
 * Deliberately the same shape as session-desktop's `PubKey.shorten`: four characters each side,
 * three dots, and the parentheses that tell a reader this is an ID standing in for a name
 * rather than a name somebody chose. An ID shortened two ways across two clients is one that
 * cannot be compared against the other device's screen, which is the only thing it is for.
 */
function shortenAccountId(id: string, keepCharacters = 4): string {
  if (id.length <= keepCharacters * 2) return id
  return `(${id.slice(0, keepCharacters)}...${id.slice(-keepCharacters)})`
}
