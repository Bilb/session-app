/**
 * Onboarding as a state machine, ported from the legacy clients.
 *
 *     PHONE    CREATE   landing -> pickDisplayName -> messageNotifications -> done
 *     PHONE    RESTORE  landing -> loadAccount     -> messageNotifications -> loading -> done
 *     TABLET   CREATE   landing -> pickDisplayName -> messageNotifications -> done
 *     TABLET   RESTORE  landing -> loadAccount     -> messageNotifications -> loading -> done
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
 * Which client's onboarding this is: a layout and a sequence, which are not the same question.
 *
 * A tablet is **the desktop layout with the phone's notification step** -- artwork and a centred
 * column, and still asked how it should hear about a message, because the OS suspends it the way a
 * phone's does. Reading the sequence off the layout is what put a phone's question on a desktop
 * screen the first time, so the two inputs stay separate: the width says which layout, and the
 * notifications port says whether there is a mode to choose.
 */
export type OnboardingDesign = 'phone' | 'desktop' | 'tablet'

/** Whether this design draws the desktop client's two-column frame rather than filling a phone. */
export function isWideDesign(design: OnboardingDesign): boolean {
  return design !== 'phone'
}

/** Whether this design asks which way notifications should arrive. */
export function asksAboutNotifications(design: OnboardingDesign): boolean {
  return design !== 'desktop'
}

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
  /**
   * Which way the last move went.
   *
   * For the transition between steps, which has to travel the way a stack would move it: forward
   * slides the new step in from the trailing edge, back sends it the other way. A flow with no
   * stack behind it has nothing else to ask -- and `back` is not the only event that goes
   * backwards, so it is recorded rather than inferred from the step.
   */
  lastMove: 'forward' | 'back'
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
    lastMove: 'forward',
  }
}

export type OnboardingEvent =
  | { type: 'chooseCreate' }
  | { type: 'chooseRestore' }
  | { type: 'nameEntered'; name: string }
  | { type: 'phraseEntered'; from: RecoveryInput }
  | {
      type: 'notificationsChosen'
      mode: NotificationMode
      /**
       * Whether the restored profile is already here, which decides if there is anything to wait
       * for.
       *
       * Passed in rather than read, because this reducer knows nothing about the bridge. Ignored
       * in the create branch, where nothing was ever being fetched.
       */
      profileArrived?: boolean
    }
  /** The restore wait ran out. See `afterFailedRestore`. */
  | { type: 'restoreGaveUp' }
  /** The restored profile came back from the swarm, so there is nothing left to ask. */
  | { type: 'restoreArrived' }
  /** libsession would not take the phrase over, after having said it was a phrase. */
  | { type: 'restoreFailed' }
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
      // **After a failed restore, back goes to the phrase rather than to the start.** Somebody
      // whose restore timed out and who then presses back is far more likely to want to try the
      // phrase again -- perhaps on a better connection -- than to begin from nothing. Creating
      // still leads back to the start, because there is nothing behind it.
      return state.afterFailedRestore ? 'loadAccount' : 'landing'
    case 'loadAccount':
      return 'landing'
    case 'messageNotifications':
      return state.branch === 'create' ? 'pickDisplayName' : 'loadAccount'
    case 'loading':
      // **The wait can be left.** An account exists by this point, but the bridge can discard
      // one, so there is a way out to offer -- and without it somebody who mistyped a phrase, or
      // simply changed their mind, sits through fifteen seconds with none. The legacy Android
      // client offers back here for the same reason. It leads where it came from, so a second
      // press reaches the phrase.
      return asksAboutNotifications(state.design) ? 'messageNotifications' : 'loadAccount'
    default:
      return null
  }
}

/**
 * Whether going back from here has to throw an account away first.
 *
 * **True wherever one has been minted.** Restore mints at the phrase, so every step past it
 * qualifies, plus the name picker a failed restore lands in. Creating holds the name and mints at
 * the end, so backing out of it has nothing to undo.
 *
 * No step has to *ask*, because `discardAccount` can untake an account -- a warning dialog would
 * only be standing in for a discard the bridge is able to perform.
 */
export function backDiscardsAccount(state: OnboardingState): boolean {
  if (state.branch !== 'restore') return false
  return (
    state.step === 'messageNotifications' ||
    state.step === 'pickDisplayName' ||
    // The wait is past the phrase, so an account exists behind it too.
    state.step === 'loading'
  )
}

export function onboardingReducer(state: OnboardingState, event: OnboardingEvent): OnboardingState {
  const next = advance(state, event)
  const move = moveOf(event)
  if (move === null || next === state) return next
  return { ...next, lastMove: move }
}

/**
 * Which way an event travels.
 *
 * `back` is not the only one that goes backwards: a refused phrase and a refused commit both
 * return to a screen that has already been seen, and sliding those in from the far side would say
 * the flow had moved on. A resize is not a move at all and leaves the last one alone.
 */
function moveOf(event: OnboardingEvent): 'forward' | 'back' | null {
  switch (event.type) {
    case 'back':
    case 'restoreFailed':
    case 'commitFailed':
      return 'back'
    case 'designChanged':
      return null
    default:
      return 'forward'
  }
}

function advance(state: OnboardingState, event: OnboardingEvent): OnboardingState {
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
          state.afterFailedRestore || !asksAboutNotifications(state.design)
            ? 'done'
            : 'messageNotifications',
      }

    case 'phraseEntered':
      return {
        ...state,
        recovery: event.from,
        step: asksAboutNotifications(state.design) ? 'messageNotifications' : 'loading',
      }

    case 'notificationsChosen':
      // Create is finished here -- this is where the account gets made. Restore usually still has
      // to wait for the swarm, which is what `loading` is.
      //
      // **Unless the swarm already answered.** The fetch starts when the phrase is accepted and
      // runs while this question is being read, so on a good connection the profile is often here
      // before it is answered -- and a wait with nothing to wait for is a screen that appears and
      // vanishes. The legacy iOS client skips it for the same reason. A product call.
      return {
        ...state,
        notifications: event.mode,
        step: state.branch === 'create' || event.profileArrived === true ? 'done' : 'loading',
      }

    case 'restoreGaveUp':
      // Not back to the phrase: it decoded, so there is nothing to retype. The account exists and
      // wants a name, which is the create branch's screen wearing different words.
      //
      // The words go here. They have done their work -- the account is taken over -- and holding
      // them for the rest of the flow is a copy of the whole account sitting in memory for no
      // reason. They cannot be wiped, so the most that can be done is to stop referencing them.
      return { ...state, step: 'pickDisplayName', afterFailedRestore: true, recovery: null }

    case 'restoreArrived':
      // The name came with the account, so the flow is over: asking for one now would be asking
      // somebody to rename themselves. The words are dropped for the reason above.
      return { ...state, step: 'done', recovery: null }

    case 'restoreFailed':
      // Back to the phrase. It decoded a moment ago, so this is not a typo -- but this is the step
      // that owns the field, and it is the only one that can be tried again.
      return { ...state, step: 'loadAccount' }

    case 'commitFailed':
      // Back to the name picker whichever way `done` was reached: it is the only step left that
      // asks a question, and the name it collected is still held so nothing has to be retyped.
      return { ...state, step: 'pickDisplayName', commitFailed: true }

    case 'designChanged':
      return { ...state, design: event.design }

    case 'back': {
      const previous = previousStep(state)
      if (previous === null) return state
      // **Reaching the landing screen is starting over, not merely a step backwards.** Anything
      // collected on the way belongs to an attempt that has been abandoned -- and after a discard
      // it belongs to an account that no longer exists on this device. Carrying a display name or
      // a recovery phrase into the next attempt is the leak this flow exists to prevent, one level
      // above the database.
      if (previous === 'landing') return { ...initialOnboarding(state.design), step: 'landing' }
      return { ...state, step: previous }
    }
  }
}
