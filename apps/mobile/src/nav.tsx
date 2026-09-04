import { NavProvider, type NavPort } from '@session/app'
import { router } from 'expo-router'
import { useMemo, type ReactNode } from 'react'

/**
 * expo-router, behind the port.
 *
 * The assertions look redundant on a fresh checkout and are not: expo-router narrows Href to
 * a union generated from the route files into gitignored .expo/types, so a plain string
 * stops being assignable the moment the app has been run once. The route-contract test is
 * what actually proves these paths exist.
 */
export function MobileNavProvider({ children }: { children: ReactNode }) {
  const nav = useMemo<NavPort>(
    () => ({
      /* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
      push: (path) => router.push(path as never),
      replace: (path) => router.replace(path as never),
      /* eslint-enable @typescript-eslint/no-unnecessary-type-assertion */
      back: () => {
        if (router.canGoBack()) router.back()
      },
    }),
    [],
  )

  return <NavProvider nav={nav}>{children}</NavProvider>
}
