import { requirePorts } from './ports'

/**
 * The schemes a link may use to leave the app.
 *
 * Plain http as well as https, which is what every current client does -- two of them go further
 * and upgrade a scheme-less address to https rather than refusing it, so refusing http here would
 * be stricter than anything shipped. Case-insensitive: a scheme is not case-sensitive, and
 * `HTTP://` doing nothing at all is a worse failure than opening it.
 */
const OPENABLE = /^https?:\/\//i

/**
 * Whether this is a URL the app may hand to the OS.
 *
 * **One check, at the boundary, rather than one per platform.** Handing a URL out is the moment
 * an app stops being in control of what happens next: `openExternal` and `Linking.openURL` both
 * give any scheme to the OS, and a `file:` or a custom scheme reaching either is how a link
 * becomes a launched program. The three platforms have three ways of opening a URL and there is
 * no reason for them to have three opinions about which ones may be opened.
 *
 * A scheme check is the floor rather than the whole job. It says nothing about a host that reads
 * as one domain and resolves to another -- userinfo before the authority, or a mixed-script
 * domain -- and those want their own check wherever a URL arrives from a message rather than
 * from this app's own constants.
 */
export function isOpenableUrl(url: string): boolean {
  return OPENABLE.test(url)
}

/**
 * Hands a URL to the OS, or refuses it.
 *
 * **The one way out, so that the check cannot be gone round.** A port implementation is a thin
 * wrapper over the platform's own call and each would otherwise have to remember this; a screen
 * calling `linking.openUrl` directly would skip whichever one it did not go through. Desktop
 * checks again in its main process, which is a different boundary: that one does not trust the
 * renderer, this one is the app deciding what it is willing to open.
 *
 * Returns whether it went. A refusal is a bug in the caller rather than something to tell the
 * person about -- every URL the app opens today is one of its own constants -- so it is reported
 * rather than thrown, and the screen carries on closing either way.
 */
export async function openExternalUrl(url: string): Promise<boolean> {
  if (!isOpenableUrl(url)) return false
  await requirePorts().linking.openUrl(url)
  return true
}
