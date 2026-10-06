import { afterEach, describe, expect, it } from 'vitest'

import { resetDebugMode, toggleDebugMode } from '#src/debugMode'
import { resetPorts, setPorts } from '#src/ports'
import { memoryPorts } from '#src/testPorts'

afterEach(() => {
  resetDebugMode()
  resetPorts()
})

describe('debug mode', () => {
  it('turns over from the flag, and back', () => {
    setPorts(memoryPorts())
    expect(toggleDebugMode()).toBe(true)
    expect(toggleDebugMode()).toBe(false)
  })

  /** A build started with it on is turned off by the first toggle, not turned on again. */
  it('starts where the environment put it', () => {
    setPorts(
      memoryPorts({
        flags: {
          override: (name) => (name === 'EXPO_PUBLIC_SESSION_FLAG_DEBUG_MODE' ? '1' : null),
        },
      }),
    )
    expect(toggleDebugMode()).toBe(false)
  })
})
