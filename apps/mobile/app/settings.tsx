import { SettingsScreen, useLocale } from '@session/screens'

/** The route file is the boundary: the screen itself never reads a router. */
export default function SettingsRoute() {
  useLocale()
  return <SettingsScreen />
}
