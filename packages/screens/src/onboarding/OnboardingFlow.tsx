import { flag, requirePorts } from '@session/app'
import { useAccount, useSessionActions } from '@session/state'
import { StepTransition, useMedia } from '@session/ui'
import { useEffect, useReducer, useState } from 'react'

import { ConfirmUrlProvider } from './ConfirmUrl'
import { LandingScreen } from './LandingScreen'
import { LoadAccountScreen } from './LoadAccountScreen'
import { LoadingScreen } from './LoadingScreen'
import { MessageNotificationsScreen } from './MessageNotificationsScreen'
import { PickDisplayNameScreen } from './PickDisplayNameScreen'
import {
  backDiscardsAccount,
  initialOnboarding,
  onboardingReducer,
  type OnboardingDesign,
  type OnboardingState,
  type RecoveryInput,
} from './flow'

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
   * accepted, but the flow still has a profile to wait for and, on a phone, a question to ask.
   * Without this the conversation list swaps in underneath a restore that is still running.
   *
   * True from the first step past the landing screen until everything has been committed.
   */
  onRunningChange?: (running: boolean) => void
}

/**
 * Onboarding, from the first screen to an account.
 *
 * One route and an internal step, rather than a route per screen. Both apps choose onboarding from
 * state rather than by navigating -- until an identity exists this is all the app can show -- and
 * the legacy clients treat back the same way, offering to quit rather than popping a stack.
 *
 * The bridge calls live here and nowhere else, so "when is the account actually made" stays
 * answerable by reading one file. `flow.ts` only decides which screen is next.
 */
export function OnboardingFlow({ onRunningChange }: OnboardingFlowProps = {}) {
  const actions = useSessionActions()
  const design = useOnboardingDesign()
  const [state, dispatch] = useReducer(onboardingReducer, design, initialOnboarding)
  const [busy, setBusy] = useState(false)
  const [rejected, setRejected] = useState(false)
  const account = useAccount()

  /**
   * Going back, with whatever has been minted thrown away first.
   *
   * The account is real by the time the restore branch is past its phrase screen, so backing out
   * of it is not a navigation -- it is a decision to be rid of an account. `discardAccount` deletes
   * the database and opens a fresh one, which is what lets back go back at all rather than offering
   * to quit.
   */
  const goBack = () => {
    if (!backDiscardsAccount(state)) {
      dispatch({ type: 'back' })
      return
    }
    setBusy(true)
    void actions
      .discardAccount()
      .catch(() => {
        // Nothing to tell the person: the screen they are going back to is the one that starts
        // again from nothing, and a discard that failed leaves an account they are about to
        // replace anyway. Logged by the store.
      })
      .finally(() => {
        setBusy(false)
        dispatch({ type: 'back' })
      })
  }

  /** Whether there is a profile on its way at all. Nothing is fetched in the create branch. */
  const restoring = state.branch === 'restore'

  /**
   * Whether the restored profile has landed -- an account with a name on it.
   *
   * The name is the whole test: the account exists from the moment the phrase is accepted, so
   * `haveAccount` says nothing about whether the swarm has answered yet.
   */
  const profileArrived =
    account?.haveAccount === true &&
    account.displayName !== undefined &&
    account.displayName.length > 0

  /**
   * The profile arriving is what ends the wait early.
   *
   * Without it the wait runs its full fifteen seconds and then asks for a name the swarm has
   * already supplied, renaming anybody patient enough to sit through it.
   *
   * Polled rather than waited on: libsession pushes conversations and messages but has no event for
   * the account. Once a second, at most fifteen times, only while this step is on screen.
   */
  useEffect(() => {
    // The question before the wait counts too: the fetch is already running behind it, and asking
    // only during the wait means the answer is always stale by exactly the time somebody spent
    // reading the question -- which is the time that decides whether the wait is needed at all.
    if (state.step !== 'loading' && !(state.step === 'messageNotifications' && restoring)) return
    const timer = setInterval(() => {
      void actions.refreshAccount().catch(() => {
        // The wait's own timeout covers this: a refresh that fails is one the next tick repeats,
        // and if they all fail the step ends the way it would have anyway.
      })
    }, PROFILE_POLL_MS)
    return () => {
      clearInterval(timer)
    }
  }, [state.step, restoring, actions])

  useEffect(() => {
    if (state.step !== 'loading') return
    if (!profileArrived) return
    dispatch({ type: 'restoreArrived' })
  }, [state.step, profileArrived])

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

  const body = screen()

  return (
    <ConfirmUrlProvider>
      {/* **Phone only.** The wide designs cross-fade inside the chrome, which is what the desktop
          client does; a horizontal push is a mobile idiom. Nothing renders at `done`, so there is
          nothing to slide in either -- wrapping it would animate a blank pane over the last step. */}
      {design === 'phone' && body !== null ? (
        <StepTransition
          stepKey={state.step}
          direction={state.lastMove}
          instant={flag('disableAnimations')}
        >
          {body}
        </StepTransition>
      ) : (
        body
      )}
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
            onBack={goBack}
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
              // **Checked, then taken over, both before leaving this screen.**
              //
              // Checked first so that a phrase with a typo in it never mints anything: the refusal
              // puts somebody back on this screen with what they typed still on it, and nothing
              // has happened. Taken over immediately after, so that fetching the profile runs
              // while the next screen is being read -- on a phone that is the notification
              // question, and the wait after it is often over before it is drawn. Minting late
              // spends that overlap, which is the one both mobile clients take.
              //
              // Going back from here on is a discard rather than a navigation. See `goBack`.
              setBusy(true)
              setRejected(false)
              void check(from, actions)
                .then(() => actions.restoreAccount(from))
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
            onBack={goBack}
            onContinue={(mode) => {
              dispatch({ type: 'notificationsChosen', mode, profileArrived })
            }}
          />
        )

      case 'loading':
        return (
          <LoadingScreen
            onBack={goBack}
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
  const asks =
    requirePorts().notifications.notificationModesApply || flag('forceOnboardingTabletDesign')
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
    // Last, and only once the rest has worked. Until this lands the account is provisional and a
    // restart throws it away -- which is exactly what should happen if onboarding died before
    // reaching here, and exactly what must not happen now that it has.
    await actions.keepAccount()
  } finally {
    setBusy(false)
  }
}
