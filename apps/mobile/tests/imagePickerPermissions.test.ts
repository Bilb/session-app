/// <reference types="node" />
import { describe, expect, it } from 'vitest'

// Loaded by URL so the type check stays out of app.config.ts, which Expo runs under its own rules.
const configModule = new URL('../app.config.ts', import.meta.url).href
const { default: appConfig } = (await import(configModule)) as {
  default: (context: { config: Record<string, unknown> }) => {
    plugins?: unknown[]
    android?: { blockedPermissions?: string[] }
  }
}

/**
 * expo-image-picker reads `cameraPermission: false` as "block CAMERA for every module", which
 * writes `tools:node="remove"` into the merged manifest and leaves the QR scanner unable to ask.
 */
describe('the image picker plugin', () => {
  const config = appConfig({ config: { name: 'Session', slug: 'session' } })
  const entry = (config.plugins ?? []).find(
    (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-image-picker',
  )
  const options = (Array.isArray(entry) ? entry[1] : undefined) as
    Record<string, unknown> | undefined

  it('is configured with options', () => {
    expect(options).toBeDefined()
  })

  it('leaves the camera to the modules that declare it, with the catalogue’s purpose string', () => {
    expect(options?.['cameraPermission']).not.toBe(false)
    expect(typeof options?.['cameraPermission']).toBe('string')
  })

  // `false` deletes the plist key, and expo-camera then writes Expo's default English there.
  it('gives the microphone the catalogue’s purpose string, and Android no audio grant', () => {
    expect(typeof options?.['microphonePermission']).toBe('string')
    expect(config.android?.blockedPermissions).toContain('android.permission.RECORD_AUDIO')
  })
})

describe('picked photos', () => {
  it('reach the app with their location removed by the system picker', () => {
    const config = appConfig({ config: { name: 'Session', slug: 'session' } })
    expect(config.android?.blockedPermissions).toContain('android.permission.ACCESS_MEDIA_LOCATION')
  })
})
