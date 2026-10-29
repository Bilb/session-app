import type { ConversationTimeOptions } from '@session/localization'
import { useMemo } from 'react'

import { useFormattingLocale } from './useLocale'

/**
 * How every time and date on screen is worded: the conversation list's timestamps and the
 * transcript's date headers alike. One place, so that the reader's own choice changes them all at
 * once and the two never disagree.
 */
export function useTimeFormats(): ConversationTimeOptions {
  const locale = useFormattingLocale()
  // TODO: take the reader's own clock and date layout once the appearance settings exist to choose
  // them; until then every time follows the system's.
  return useMemo(() => ({ timeFormat: 'system', dateFormat: 'system', locale }), [locale])
}
