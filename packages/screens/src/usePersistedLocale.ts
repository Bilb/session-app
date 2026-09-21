import {
  followSystemLocale,
  followingSystemLocale,
  getLocale,
  isCrowdinLocale,
  setLocale,
  subscribeLocale,
  type CrowdinLocale,
} from '@session/localization'
import { useAccount, useSessionActions } from '@session/state'
import { useEffect, useRef } from 'react'

/**
 * The key the chosen language is stored under, in libsession's globals.
 *
 * Namespaced because that table is shared with everything else the account carries.
 */
const LOCALE_PREF = 'app.locale'

/** What is written for somebody who follows the device rather than a language of their own. */
const SYSTEM = 'system'

/**
 * What to store when the account first appears and nothing has been stored yet.
 *
 * **This is the write that onboarding depends on.** A language picked before an account exists
 * has nowhere to go, so it lives in memory until one does -- and the only other write happens on
 * a *change*, which never comes: onboarding is over by then and nobody touches the picker again.
 * Without this the app comes back in the device's language on the next launch, having shown the
 * chosen one throughout.
 *
 * Null where following the device, which is the default: somebody who chose "Default" and
 * somebody who chose nothing are the same state and want the same behaviour, so there is nothing
 * worth recording.
 */
export function localeToStoreFirst(
  stored: string | undefined,
  following: boolean,
  current: CrowdinLocale,
): string | null {
  if (stored !== undefined) return null
  return following ? null : current
}

/**
 * Keeps the chosen language across launches, once there is an account to keep it against.
 *
 * **Nothing can be stored until an account exists**, so a language chosen during onboarding lives
 * in memory and is written the moment the account appears. That is the whole reason this watches
 * the account rather than running once: onboarding is the one stretch of the app where somebody
 * picks a language and there is nowhere to put it yet.
 *
 * **"Following the device" is stored, not the language it currently resolves to.** The two look
 * identical on the day they are chosen and behave differently afterwards -- one follows the device
 * when it changes and the other does not -- so writing the resolved locale would quietly convert
 * the first into the second.
 */
export function usePersistedLocale(): void {
  const actions = useSessionActions()
  const account = useAccount()
  const haveAccount = account?.haveAccount === true
  // What was read back, so the read does not immediately write itself out again -- and so the
  // first write only happens once somebody has actually chosen something.
  const loaded = useRef(false)

  useEffect(() => {
    if (!haveAccount || loaded.current) return
    let live = true
    void actions.getPreference(LOCALE_PREF).then((stored) => {
      if (!live) return
      loaded.current = true
      if (stored === undefined) {
        const first = localeToStoreFirst(stored, followingSystemLocale(), getLocale())
        if (first !== null) void actions.setPreference(LOCALE_PREF, first)
        return
      }
      if (stored === SYSTEM) followSystemLocale()
      else if (isCrowdinLocale(stored)) setLocale(stored)
      // An unknown value is left alone rather than reset: it is likelier to be a newer build's
      // locale than a corrupt one, and overwriting it would lose the choice on the next launch.
    })
    return () => {
      live = false
    }
  }, [haveAccount, actions])

  useEffect(() => {
    if (!haveAccount) return
    return subscribeLocale(() => {
      if (!loaded.current) return
      void actions.setPreference(LOCALE_PREF, followingSystemLocale() ? SYSTEM : getLocale())
    })
  }, [haveAccount, actions])
}
