import { isWeb } from 'tamagui'

/**
 * Whether this is the desktop app. There is no web app, so the web renderer is Electron's: for a
 * setting that differs between the desktop and the phones, not for anything a platform split
 * (`.native.tsx`) should carry.
 */
export const DRAWN_ON_DESKTOP = isWeb
