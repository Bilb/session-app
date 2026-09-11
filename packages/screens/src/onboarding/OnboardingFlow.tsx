import { flag, requirePorts } from '@session/app'
import { useAccount, useSessionActions } from '@session/state'
import { useMedia } from '@session/ui'
import { useEffect, useReducer, useRef, useState } from 'react'

import { ConfirmUrlProvider } from './ConfirmUrl'
import { LandingScreen } from './LandingScreen'
import { QuitWarningModal } from './QuitWarningModal'
import { LoadAccountScreen } from './LoadAccountScreen'
import { LoadingScreen } from './LoadingScreen'
import { MessageNotificationsScreen } from './MessageNotificationsScreen'
import { PickDisplayNameScreen } from './PickDisplayNameScreen'
import {
  backNeedsConfirming,
  initialOnboarding,
  onboardingReducer,
  type OnboardingDesign,
  type OnboardingState,
  type RecoveryInput,
} from './flow'

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
/**
 * How often the restore wait asks whether the profile has landed.
 *
 * A second is far below anything anybody perceives against a fifteen-second wait, and well above
 * what a local database read costs.
 */
const PROFILE_POLL_MS = 1000

interface OnboardingFlowProps {
  /**
   * Whether onboarding still owns the screen.
   *
   * The apps choose onboarding by asking whether there is an account, which stops being the right
   * question the moment a restore succeeds: the account exists from the instant the phrase is
   * accepted, but the flow is not finished -- it still has to wait for the profile, and on a phone
   * it has not asked about notifications yet. Without this the app swapped the conversation list in
   * underneath a restore that was still running, and the wait screen was never seen at all.
   *
   * True from the first step past the landing screen until everything has been committed.
   */
  onRunningChange?: (running: boolean) => void
}

export function OnboardingFlow({ onRunningChange }: OnboardingFlowProps = {}) {
  const actions = useSessionActions()
  const design = useOnboardingDesign()
  const [state, dispatch] = useReducer(onboardingReducer, design, initialOnboarding)
  const [busy, setBusy] = useState(false)
  const [rejected, setRejected] = useState(false)
  const [quitting, setQuitting] = useState(false)
  const account = useAccount()
  /** Guards the one call that mints a restored account, so a re-render cannot make two of them. */
  const restoring = useRef(false)

  /**
   * The restore itself, at the wait rather than at the phrase.
   *
   * This is the step the wait is a wait *for*, and putting it here is what leaves every step
   * before it free of an account: the phrase screen only asks libsession whether the words decode.
   */
  useEffect(() => {
    if (state.step !== 'loading' || state.recovery === null || restoring.current) return
    restoring.current = true
    void actions.restoreAccount(state.recovery).catch(() => {
      restoring.current = false
      dispatch({ type: 'restoreFailed' })
      setRejected(true)
    })
  }, [state.step, state.recovery, actions])

  /**
   * The profile arriving is what ends the wait early.
   *
   * Without this the wait always ran its full fifteen seconds and then asked for a name, even when
   * the swarm had already answered -- which is the timeout doing the work the arrival was supposed
   * to do, and it renames anybody patient enough to sit through it.
   *
   * Asked for rather than waited on: libsession pushes conversations and messages but has no event
   * for the account, so nothing tells the app the name has landed. Once a second for at most
   * fifteen of them, only while this step is on screen.
   */
  useEffect(() => {
    if (state.step !== 'loading') return
    const timer = setInterval(() => {
      void actions.refreshAccount().catch(() => {
        // The wait's own timeout covers this: a refresh that fails is one the next tick repeats,
        // and if they all fail the step ends the way it would have anyway.
      })
    }, PROFILE_POLL_MS)
    return () => {
      clearInterval(timer)
    }
  }, [state.step, actions])

  useEffect(() => {
    if (state.step !== 'loading') return
    if (account?.haveAccount !== true) return
    if (account.displayName === undefined || account.displayName.length === 0) return
    dispatch({ type: 'restoreArrived' })
  }, [state.step, account])

  useEffect(() => {
    // A rotation or a resize mid-flow changes what comes next, so the reducer is told rather than
    // left holding whichever design the window happened to be when this started.
    if (state.design !== design) dispatch({ type: 'designChanged', design })
  }, [design, state.design])

  // Reported rather than derived, because only the flow knows the difference between "there is an
  // account now" and "this is over".
  useEffect(() => {
    onRunningChange?.(state.step !== 'landing')
  }, [state.step, onRunningChange])

  useEffect(() => {
    if (state.step !== 'done') return
    // `done` is reached from two places and means something different at each: the end of create,
    // where there is no account yet, and the end of a restore that had to ask for a name.
    void commit(state, actions, setBusy).then(
      () => {
        onRunningChange?.(false)
      },
      () => {
        // Nothing renders at `done`, so a rejection here would otherwise be an empty window with
        // nothing said and nowhere to go.
        dispatch({ type: 'commitFailed' })
      },
    )
  }, [state, actions, onRunningChange])

  return (
    <ConfirmUrlProvider>
      {screen()}
      <QuitWarningModal
        open={quitting}
        onQuit={() => {
          requirePorts().window.close()
        }}
        onCancel={() => {
          setQuitting(false)
        }}
      />
    </ConfirmUrlProvider>
  )

  function screen() {
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
            initialName={state.displayName ?? ''}
            rejected={state.commitFailed}
            busy={busy}
            onBack={() => {
              // The rule lives in the reducer, which is the thing that knows what has been made
              // by now. See backNeedsConfirming: this is the only step it is ever true on.
              if (backNeedsConfirming(state)) setQuitting(true)
              else dispatch({ type: 'back' })
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
              // Checked here and restored at the wait. A phrase the bridge refuses has to put
              // somebody back on this screen with what they typed still on it, and restoring to
              // find that out would leave an account behind every time somebody got it wrong --
              // which is what the warning on the way back used to be apologising for.
              setBusy(true)
              setRejected(false)
              void check(from, actions)
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
}

/**
 * Which of the three onboardings this is.
 *
 * Two inputs, because they are two questions. The window's width says which layout -- `gtSm` is
 * >700px, so a tablet takes the desktop frame rather than a stretched phone one, and a resize or a
 * rotation changes the answer. The notifications port says whether there is a delivery mode to
 * choose, which is an OS fact and does not change at all.
 */
function useOnboardingDesign(): OnboardingDesign {
  const wide = useMedia().gtSm
  // The flag is an override for looking at it, not a second source of truth: see its entry in the
  // flag table for why the tablet design is otherwise unreachable on the machines it is built on.
  const asks = requirePorts().notifications.notificationModesApply || flag('onboardingTabletDesign')
  if (!wide) return 'phone'
  return asks ? 'tablet' : 'desktop'
}

/**
 * Whether a phrase would restore, asked without restoring it.
 *
 * A raw seed has nothing to check that the restore does not check anyway, so it goes straight
 * through -- there is no phrase to put back on a screen and no word list involved.
 */
async function check(
  from: RecoveryInput,
  actions: ReturnType<typeof useSessionActions>,
): Promise<void> {
  if ('hexSeed' in from) return
  await actions.checkRecoveryPhrase(from.words, from.language)
}

/**
 * Everything that has to happen before the app has an account, once the questions are answered.
 *
 * Create mints the identity here, at the end, because that is where the legacy clients do it: a
 * name typed and then abandoned should leave nothing behind. Restore has minted one by this point
 * too -- at the wait, which is the step that exists to cover it -- so this only names it, and only
 * when the swarm never sent one.
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
