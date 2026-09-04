import { NavProvider, type NavPort } from '@s2/app'
import { useMemo, type ReactNode } from 'react'
import { useNavigate } from 'react-router'

/**
 * react-router, behind the port.
 *
 * This file is the only place in the desktop app that knows which router it uses; the
 * screens ask for a NavPort and get one.
 */
export function DesktopNavProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()

  const nav = useMemo<NavPort>(
    () => ({
      push: (path) => void navigate(path),
      replace: (path) => void navigate(path, { replace: true }),
      back: () => void navigate(-1),
    }),
    [navigate],
  )

  return <NavProvider nav={nav}>{children}</NavProvider>
}
