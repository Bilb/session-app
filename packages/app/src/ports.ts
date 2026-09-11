import type { NetworkName } from '@session/basic-types'
/**
 * What the app needs from the operating system, named so shared code can ask without
 * knowing which one it is running on.
 *
 * libsession owns the database, the network and the protocol, so nothing here is about
 * data - these are the things an OS does: pick a file, show a notification, remember a key.
 *
 * Set once at boot, before anything renders, rather than passed through React context: the
 * store and the boot sequence both read ports from outside any component, and a context
 * could not reach either. requirePorts() throws rather than returning null because a
 * missing port is a mistake in the app's entry file, and failing here names it instead of
 * surfacing three screens later as a null dereference.
 */

export interface SecureStore {
  /**
   * libsession accepts a database key but neither derives nor stores one, so the app
   * generates it on first run and is responsible for keeping it. This is the only secret
   * the port holds.
   */
  getDatabaseKey(): Promise<Uint8Array | null>
  setDatabaseKey(key: Uint8Array): Promise<void>
}

export interface PickedFile {
  /** A real filesystem path: libsession takes paths, not blobs. */
  path: string
  name: string
  contentType?: string
  size?: number
}

export interface FilesPort {
  pickFiles(options?: { multiple?: boolean }): Promise<PickedFile[]>
  pickImages(options?: { multiple?: boolean }): Promise<PickedFile[]>
  /** Where to save something; null when the person cancelled. */
  chooseSaveLocation(suggestedName: string): Promise<string | null>
  openPath(path: string): Promise<void>
  revealInFolder(path: string): Promise<void>
}

export interface MediaProbePort {
  /** libsession does not measure images; whoever attaches one supplies the dimensions. */
  imageSize(path: string): Promise<{ width: number; height: number } | null>
}

export interface NotificationsPort {
  /**
   * Whether this build has a push service behind it.
   *
   * Onboarding asks which of two notification modes to use, and marks the push one either
   * `recommended` or `unavailable`. Which of those it is depends on how the build was assembled --
   * a Play build has FCM, an F-Droid or web-download build does not, and desktop has neither --
   * so it is answered at the app edge rather than guessed at from the platform.
   *
   * False everywhere today: there is no push service wired up on any of the three. It turns true
   * per build as one arrives.
   */
  readonly fastModeAvailable: boolean
  requestPermission(): Promise<boolean>
  show(notification: { conversationId: string; title: string; body: string }): Promise<void>
  onTap(handler: (conversationId: string) => void): () => void
  setBadgeCount(count: number): Promise<void>
}

export interface ClipboardPort {
  setString(value: string): Promise<void>
  getString(): Promise<string>
}

export interface LinkingPort {
  openUrl(url: string): Promise<void>
  /**
   * The OS's own per-app language screen, or null where the build has not got one.
   *
   * Null is the normal answer and not a stub. Both mobile platforms have such a screen, and
   * neither shows it for an app like this one: iOS lists Preferred Language only for a bundle that
   * declares more than one localization, and Android shows App Language only on 13 or newer and
   * only for an app that ships a `localeConfig`. This app declares its languages to neither OS
   * yet, so sending somebody to the settings page would land them on one with no language row on
   * it -- worse than the picker doing the job itself.
   *
   * It is the capability check the language picker reads, so this turns non-null in the same
   * change that teaches the two builds to declare their locales, and the picker starts handing
   * over on its own. Desktop stays null: there is no such screen to hand over to.
   */
  openLanguageSettings: (() => Promise<void>) | null
}

export interface WindowPort {
  /**
   * Shuts the app down, for the one dialog that offers to.
   *
   * Only onboarding needs it, and only where back has nowhere to go and something has already been
   * made that leaving would abandon. Desktop closes its window, which with one window is quitting.
   * Mobile does nothing: iOS forbids an app terminating itself and Android merely discourages it,
   * so a phone shows the dialog without that door.
   */
  close(): void
  isFocused(): boolean
  /** Drives read receipts and whether a notification is worth showing. */
  onFocusChange(handler: (focused: boolean) => void): () => void
}

export interface NetworkPort {
  name: NetworkName
}

export interface FlagsPort {
  /**
   * The raw value of an environment variable, or null when it is unset.
   *
   * A port because the three platforms expose the environment differently -- `process.env` in the
   * Electron main process, a build-time define in the renderer, and Expo's config extras on
   * mobile -- and shared code should not know which of those it is standing on. It returns the raw
   * string rather than a boolean so the parsing rule lives in one place, next to the flag table.
   */
  override(name: string): string | null
}

export interface Ports {
  network: NetworkPort
  flags: FlagsPort
  secureStore: SecureStore
  files: FilesPort
  mediaProbe: MediaProbePort
  notifications: NotificationsPort
  clipboard: ClipboardPort
  linking: LinkingPort
  window: WindowPort
}

let current: Ports | null = null

export function setPorts(ports: Ports): void {
  current = ports
}

export function requirePorts(): Ports {
  if (current === null) {
    throw new Error(
      'No ports installed. Import the app entry that calls setPorts() before rendering anything from @session/app.',
    )
  }
  return current
}

/** Test seam: lets a suite install its own ports and put them back afterwards. */
export function resetPorts(): void {
  current = null
}
