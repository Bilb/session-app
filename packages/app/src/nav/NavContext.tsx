import { createContext, createElement, useContext, type ReactNode } from 'react'

/**
 * Going somewhere, without saying which router does it.
 *
 * expo-router and react-router agree on nothing except that a path names a destination, so
 * a screen that imports either one can only ever run on one platform. This is the seam.
 */
export interface NavPort {
  push(path: string): void
  replace(path: string): void
  back(): void
}

const NavContext = createContext<NavPort | null>(null)

export function NavProvider(props: { nav: NavPort; children: ReactNode }): ReactNode {
  return createElement(NavContext.Provider, { value: props.nav }, props.children)
}

export function useNav(): NavPort {
  const nav = useContext(NavContext)
  if (!nav) {
    throw new Error('No NavPort. Wrap the app in <NavProvider nav={...}> from its own router.')
  }
  return nav
}
