/// <reference types="node" />
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * expo-image-picker reads `cameraPermission: false` as "block CAMERA for every module", which
 * writes `tools:node="remove"` into the merged manifest and leaves the QR scanner unable to ask.
 */
describe('the image picker plugin', () => {
  const config = readFileSync(new URL('../app.config.ts', import.meta.url), 'utf8')
  const options = /'expo-image-picker',\s*\{([^}]*)\}/s.exec(config)?.[1] ?? ''

  it('is configured', () => {
    expect(options).not.toBe('')
  })

  it('leaves the camera permission to the modules that declare it', () => {
    expect(options).not.toMatch(/cameraPermission:\s*false/)
    expect(options).toContain("cameraPermission: englishPermission('NSCameraUsageDescription')")
  })
})
