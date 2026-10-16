import { SessionShell, useLocale } from '@session/screens'
import { Slot } from 'expo-router'

/**
 * The routed screens, inside the shell every platform shares.
 *
 * The routed pane is always the router's `<Slot />`, on a phone as much as a tablet: expo-router
 * navigates only while its navigator is mounted, so the list cannot take the Slot's place on a
 * phone the way it can on the desktop. The index route draws the list itself there, and the empty
 * detail pane on a tablet, where the shell already has the list beside it.
 */
export function MobileShell() {
  useLocale()
  return <SessionShell detail={<Slot />} hasDetail />
}
