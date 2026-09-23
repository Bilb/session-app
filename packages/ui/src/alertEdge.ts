/**
 * What separates an alert from the page behind it, on the web: the desktop client's one-pixel
 * border, which every one of its modals carries.
 *
 * `.native` differs by platform, because the phones do: Android draws the same border and iOS none,
 * relying on a shadow instead.
 */
export const ALERT_EDGE = { borderWidth: 1, borderColor: '$bordersColor' } as const
