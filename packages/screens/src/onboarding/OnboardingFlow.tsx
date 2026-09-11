import { useSessionActions } from '@session/state'
import { useMedia } from '@session/ui'
import { useEffect, useReducer, useState } from 'react'

import { LandingScreen } from './LandingScreen'
import { LoadAccountScreen } from './LoadAccountScreen'
import { LoadingScreen } from './LoadingScreen'
import { MessageNotificationsScreen } from './MessageNotificationsScreen'
import { PickDisplayNameScreen } from './PickDisplayNameScreen'
import { initialOnboarding, onboardingReducer, type OnboardingState } from './flow'

/**
 * Onboarding, from the first screen to an account.
 *
 * One route and an internal step, rather than a route per screen. Both apps already choose
 * onboarding from state rather than by navigating -- there is no history behind it, because until
 * an identity exists this is the only thing the app can show -- and the legacy clients treat back
 * the same way: at the first step of either branch it offers to quit rather than popping a stack.
 *
 * The bridge calls live here and nowhere else. `flow.ts` decides which screen is next and holds
 * what has been collected; this is the only thing that turns that into an account, which is what
 * keeps "when is the account actually made" answerable by reading one file.
 */
export function OnboardingFlow() {
  const actions = useSessionActions()
  // Which client's onboarding this is, from the window's width: a tablet takes the desktop flow
  // rather than a stretched phone one, and `gtSm` is >700px.
  const design = useMedia().gtSm ? 'desktop' : 'phone'
  const [state, dispatch] = useReducer(onboardingReducer, design, initialOnboarding)
  const [busy, setBusy] = useState(false)
  const [rejected, setRejected] = useState(false)

  useEffect(() => {
    // A rotation or a resize mid-flow changes what comes next, so the reducer is told rather than
    // left holding whichever design the window happened to be when this started.
    if (state.design !== design) dispatch({ type: 'designChanged', design })
  }, [design, state.design])

  useEffect(() => {
    if (state.step !== 'done') return
    // `done` is reached from two places and means something different at each: the end of create,
    // where there is no account yet, and the end of a restore that had to ask for a name.
    void commit(state, actions, setBusy)
  }, [state, actions])

  switch (state.step) {
    case 'landing':
      return (
        <LandingScreen
          onCreate={() => {
            dispatch({ type: 'chooseCreate' })
          }}
          onRestore={() => {
            dispatch({ type: 'chooseRestore' })
          }}
        />
      )

    case 'pickDisplayName':
      return (
        <PickDisplayNameScreen
          afterFailedRestore={state.afterFailedRestore}
          busy={busy}
          onBack={() => {
            dispatch({ type: 'back' })
          }}
          onContinue={(name) => {
            dispatch({ type: 'nameEntered', name })
          }}
        />
      )

    case 'loadAccount':
      return (
        <LoadAccountScreen
          busy={busy}
          rejected={rejected}
          onBack={() => {
            dispatch({ type: 'back' })
          }}
          onContinue={(from) => {
            // Restoring happens here rather than at `done`, because a phrase the bridge refuses
            // has to put somebody back on this screen with the field they typed into still on it.
            setBusy(true)
            setRejected(false)
            void actions
              .restoreAccount(from)
              .then(() => {
                dispatch({ type: 'phraseEntered', from })
              })
              .catch(() => {
                setRejected(true)
              })
              .finally(() => {
                setBusy(false)
              })
          }}
        />
      )

    case 'messageNotifications':
      return (
        <MessageNotificationsScreen
          busy={busy}
          onBack={() => {
            dispatch({ type: 'back' })
          }}
          onContinue={(mode) => {
            dispatch({ type: 'notificationsChosen', mode })
          }}
        />
      )

    case 'loading':
      return (
        <LoadingScreen
          onGaveUp={() => {
            dispatch({ type: 'restoreGaveUp' })
          }}
        />
      )

    case 'done':
      // Whatever was on screen stays there while the account is made. There is no screen of its
      // own for this: it is a call or two, and a flash of something else would read as a step.
      return null
  }
}

/**
 * Everything that has to happen before the app has an account, once the questions are answered.
 *
 * Create mints the identity here, at the end, because that is where the legacy clients do it: a
 * name typed and then abandoned should leave nothing behind. Restore has already minted one by
 * this point -- the phrase had to be checked against libsession to be accepted at all -- so this
 * only names it.
 */
async function commit(
  state: OnboardingState,
  actions: ReturnType<typeof useSessionActions>,
  setBusy: (busy: boolean) => void,
): Promise<void> {
  setBusy(true)
  try {
    if (state.branch === 'create') await actions.createAccount()
    if (state.displayName !== null) await actions.setDisplayName(state.displayName)
  } finally {
    setBusy(false)
  }
}
