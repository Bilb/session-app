import { requireOptionalNativeModule } from 'expo'
import { useEffect, useState } from 'react'
import { useWindowDimensions } from 'react-native'

interface WindowChromeModule {
  controlsInset(): Promise<number>
}

/** iOS only: see modules/window-chrome. Null on Android, which draws no controls in the window. */
const WindowChrome = requireOptionalNativeModule<WindowChromeModule>('WindowChrome')

/**
 * Re-read after the layout settles as well as at once: the window's new size reaches JS before
 * the controls' region has always been laid out for it.
 */
const SETTLE_MS = 250

/**
 * The window controls' inset, read again whenever the window changes size -- which is also what
 * entering or leaving a resizable window does, the only times the controls come or go.
 */
export function useNativeWindowControlsInset(): number {
  const { width, height } = useWindowDimensions()
  const [inset, setInset] = useState(0)

  useEffect(() => {
    if (WindowChrome === null) return
    let live = true
    const read = () => {
      void WindowChrome.controlsInset().then((value) => {
        if (live) setInset(value)
      })
    }
    read()
    const settled = setTimeout(read, SETTLE_MS)
    return () => {
      live = false
      clearTimeout(settled)
    }
  }, [width, height])

  return inset
}
