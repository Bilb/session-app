/**
 * The shortest phrase that can encode anything.
 *
 * Twelve words carry a 16-byte seed -- the codec packs three words per four bytes -- and the
 * thirteenth is the checksum. The longer option is 24 plus a checksum for a 32-byte seed.
 */
export const SHORTEST_PHRASE_WORDS = 13

/**
 * The words in a phrase as it was typed.
 *
 * Split on any run of whitespace and with punctuation dropped, because a phrase arrives pasted out
 * of a password manager or a text file as often as it arrives typed: newlines, double spaces and a
 * trailing full stop are all things the legacy clients tolerate, and refusing them would reject a
 * phrase that is perfectly correct.
 */
export function phraseWords(input: string): string[] {
  // Every call makes more strings that cannot be wiped -- the lowercased copy, the split parts.
  // Accepted rather than overlooked: see the note on `restoreAccountFromWords` in the protocol for
  // why the phrase is a string at all and what would replace it. Called once per submit rather
  // than on every keystroke, which is the one thing this file can do about it.
  return input
    .toLowerCase()
    .split(/[^\p{Letter}\p{Mark}]+/u)
    .filter((word) => word.length > 0)
}

/**
 * The one check worth making before the bridge sees it: too few words to be a phrase at all.
 *
 * Deliberately the *only* local check. libsession owns the word lists, the prefix matching and the
 * checksum, and a second copy of any of that up here is a second answer to disagree with -- but
 * counting words needs none of it, and being told "that is not long enough" beats being told "that
 * is incorrect" when half a phrase has been pasted.
 *
 * Everything else -- an unknown word, a failed checksum, a language mismatch -- comes back from
 * libsession, which raises a different exception type for each. The bridge currently flattens all
 * of them into one message, so the screen can only say something generic; carrying a code across
 * would let the other two legacy messages be used again.
 */
export function phraseIsTooShort(input: string): boolean {
  return phraseWords(input).length < SHORTEST_PHRASE_WORDS
}
