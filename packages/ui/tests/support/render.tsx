import { cleanup, render, type RenderResult } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach } from 'vitest'

import type { ThemeState } from '@session/theme-tokens'

import { UIProvider } from '#src/UIProvider'

// testing-library unmounts by itself only where vitest's globals are on, which they are not here.
afterEach(() => {
  cleanup()
})

/** Drawn as the desktop renderer draws it: inside the shared configuration, in a theme. */
export function renderInUI(ui: ReactNode, theme?: ThemeState): RenderResult {
  const wrap = (node: ReactNode) => (
    <UIProvider {...(theme === undefined ? {} : { theme })}>{node}</UIProvider>
  )
  const result = render(wrap(ui))
  return {
    ...result,
    rerender: (next: ReactNode) => {
      result.rerender(wrap(next))
    },
  }
}
