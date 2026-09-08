/**
 * Payloads shaped like the ones that actually cross the bridge.
 *
 * Field sizes are what decide these numbers, so they are taken from the real thing rather than
 * rounded: an account ID is `05` plus 64 hex characters, and at 66 bytes it is most of what a
 * Message weighs. A fixture with short ids would understate every measurement here.
 */

const HEX = '0123456789abcdef'

export function accountId(random: () => number): string {
  let id = '05'
  for (let i = 0; i < 64; i++) id += HEX[Math.floor(random() * 16)]
  return id
}
