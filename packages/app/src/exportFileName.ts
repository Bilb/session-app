// Imported by desktop main and mobile: no platform APIs.

/**
 * The bare file name in a sender's suggestion: no directory part, no control characters.
 *
 * Both separators are stripped whatever the platform, since the sender's platform is not this
 * one. This is the step the two apps share; what each does about length, a hidden name or
 * nothing left is its own policy, so the result may be empty, `.` or `..`.
 */
export function bareFileName(suggested: unknown): string {
  if (typeof suggested !== 'string') return ''
  return (
    suggested
      .slice(Math.max(suggested.lastIndexOf('/'), suggested.lastIndexOf('\\')) + 1)
      // C0, C1 and the bidi controls: `invoice\u202efdp.exe` would otherwise be shown, in a dialog
      // and in the file manager, as `invoiceexe.pdf`.
      // eslint-disable-next-line no-control-regex -- stripping control characters is the point
      .replace(/[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')
      .trim()
  )
}
