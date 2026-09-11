/**
 * Onboarding as a state machine, ported from the legacy clients.
 *
 *     PHONE    CREATE   landing -> pickDisplayName -> messageNotifications -> done
 *     PHONE    RESTORE  landing -> loadAccount     -> messageNotifications -> loading -> done
 *     DESKTOP  CREATE   landing -> pickDisplayName -> done
 *     DESKTOP  RESTORE  landing -> loadAccount     -> loading -> done
 *
 * **The two designs run different sequences, not the same one laid out differently.** Desktop has
 * no notification-mode step: fast mode is a push service, and desktop has none to offer, so the
 * question has no answer worth asking for. Treating the difference as layout produced a desktop
 * app asking a phone's question, which is what this shape exists to prevent.
 *
 * A pure reducer rather than `useState` calls spread across five screens, because three things
 * about this flow are easy to get subtly wrong and impossible to see afterwards:
 *
 * - **The account is minted at the end of create, not at the name step.** The name is collected
 *   first and held, and nothing exists until notifications have been answered. Getting this
 *   backwards leaves a half-made account behind whenever somebody backs out.
 * - **Notification mode is answered before the restore waits, not after.** Restoring can take
 *   fifteen seconds, and asking a question afterwards means fifteen seconds of nothing.
 * - **A failed restore does not go back to phrase entry.** It lands in the *create* branch's name
 *   picker with different copy, because the phrase was right -- the profile simply never arrived,
 *   and there is nothing to retype.
 *
 * The reducer knows nothing about the bridge. It says which screen is next and what has been
 * collected; `OnboardingFlow` is what turns `done` into the calls that make an account.
 */

type OnboardingStep =
  'landing' | 'pickDisplayName' | 'loadAccount' | 'messageNotifications' | 'loading' | 'done'

/** Which of the two sequences is running. Decided at the landing screen and never again. */
type OnboardingBranch = 'create' | 'restore'

/**
 * Which client's onboarding this is.
 *
 * Named for the design rather than the platform, because a tablet takes the desktop one: the
 * instruction is that an iPad gets the desktop flow rather than a stretched phone flow, so this
 * follows the window's width and can change under a rotation.
 */
export type OnboardingDesign = 'phone' | 'desktop'

/** What the recovery screen collected, in the shape the bridge takes it. */
export type RecoveryInput = { words: string[]; language?: string } | { hexSeed: string }

/**
 * Whether notifications are pushed to the device or polled for.
 *
 * Named for what it is rather than for the marketing: fast mode is a push service, and on a build
 * without one it is not merely slower but absent, which is what `unavailable` marks.
 */
export type NotificationMode = 'fast' | 'slow'

export interface OnboardingState {
  step: OnboardingStep
  design: OnboardingDesign
  branch: OnboardingBranch
  /**
   * True only when the name picker was reached by a restore that gave up.
   *
   * It changes the copy -- `displayNameNew` rather than `displayNamePick` -- and it changes what
   * happens next: there is already an account by then, so naming it is the last thing to do.
   */
  afterFailedRestore: boolean
  /** Held rather than applied, because in the create branch there is nothing to apply it to yet. */
  displayName: string | null
  recovery: RecoveryInput | null
  notifications: NotificationMode | null
  /**
   * The bridge refused the last step, the one that actually makes the account.
   *
   * There has to be somewhere for that failure to go. `done` renders nothing -- it is a call or
   * two behind whatever was last on screen -- so a rejection there left an empty window with no
   * way forward and nothing said. This sends it back to the name picker, which is the last screen
   * that can be asked again.
   */
  commitFailed: boolean
}

export function initialOnboarding(design: OnboardingDesign): OnboardingState {
  return {
    step: 'landing',
    design,
    branch: 'create',
    afterFailedRestore: false,
    displayName: null,
    recovery: null,
    notifications: null,
    commitFailed: false,
  }
}

export type OnboardingEvent =
  | { type: 'chooseCreate' }
  | { type: 'chooseRestore' }
  | { type: 'nameEntered'; name: string }
  | { type: 'phraseEntered'; from: RecoveryInput }
  | { type: 'notificationsChosen'; mode: NotificationMode }
  /** The restore wait ran out. See `afterFailedRestore`. */
  | { type: 'restoreGaveUp' }
  /** The bridge refused to make or name the account. See `commitFailed`. */
  | { type: 'commitFailed' }
  /** The window crossed the width that decides which design is in use -- a rotation, or a resize. */
  | { type: 'designChanged'; design: OnboardingDesign }
  | { type: 'back' }

/**
 * Where `back` goes from each step, or null where there is nowhere to go.
 *
 * Null is not the same as "exit". At the landing screen there is no onboarding left to back out
 * of, and on the two steps that follow an account being made there is no longer anything to undo --
 * backing out of naming a restored account would leave it nameless rather than cancel anything.
 */
function previousStep(state: OnboardingState): OnboardingStep | null {
  switch (state.step) {
    case 'pickDisplayName':
      return state.afterFailedRestore ? null : 'landing'
    case 'loadAccount':
      return 'landing'
    case 'messageNotifications':
      return state.branch === 'create' ? 'pickDisplayName' : 'loadAccount'
    case 'loading':
      // Only reachable as a back on the desktop design, where nothing was asked between the phrase
      // and the wait. There is an account by now, so there is nothing to undo.
      return null
    default:
      return null
  }
}

/** Whether `back` from here needs the "are you sure" the legacy clients show. */
export function backNeedsConfirming(state: OnboardingState): boolean {
  // Only while creating: the name has been typed and would be lost, and nothing has been made yet
  // that leaving would abandon. Restoring has a phrase the person already had written down.
  return state.step === 'pickDisplayName' && !state.afterFailedRestore
}

export function onboardingReducer(state: OnboardingState, event: OnboardingEvent): OnboardingState {
  switch (event.type) {
    case 'chooseCreate':
      return { ...state, branch: 'create', step: 'pickDisplayName', afterFailedRestore: false }

    case 'chooseRestore':
      return { ...state, branch: 'restore', step: 'loadAccount', afterFailedRestore: false }

    case 'nameEntered':
      // Three endings, not two. After a failed restore the account already exists, so naming it is
      // the last thing. On the desktop design there is no notification question to go on to, so
      // create finishes here as well.
      return {
        ...state,
        displayName: event.name,
        commitFailed: false,
        step:
          state.afterFailedRestore || state.design === 'desktop' ? 'done' : 'messageNotifications',
      }

    case 'phraseEntered':
      return {
        ...state,
        recovery: event.from,
        step: state.design === 'desktop' ? 'loading' : 'messageNotifications',
      }

    case 'notificationsChosen':
      // Create is finished here -- this is where the account gets made. Restore still has to wait
      // for the swarm, which is what `loading` is.
      return {
        ...state,
        notifications: event.mode,
        step: state.branch === 'create' ? 'done' : 'loading',
      }

    case 'restoreGaveUp':
      // Not back to the phrase: it decoded, so there is nothing to retype. The account exists and
      // wants a name, which is the create branch's screen wearing different words.
      return { ...state, step: 'pickDisplayName', afterFailedRestore: true }

    case 'commitFailed':
      // Back to the name picker whichever way `done` was reached: it is the only step left that
      // asks a question, and the name it collected is still held so nothing has to be retyped.
      return { ...state, step: 'pickDisplayName', commitFailed: true }

    case 'designChanged':
      return { ...state, design: event.design }

    case 'back': {
      const previous = previousStep(state)
      return previous === null ? state : { ...state, step: previous }
    }
  }
}
