/**
 * What the startup block says about the desktop's OS.
 *
 * macOS and Windows are named by their version, which says everything a support question needs.
 * Linux is not one OS, and most Linux-only bugs depend on things the kernel version does not say:
 * which distro, Wayland or X11 (clipboard, windows, screen capture), which desktop, and how the app
 * was packaged. Kept pure, with the environment passed in, so it can be tested anywhere.
 */

/** `macOS 15.1`, `Windows 10.0.26100`, `Linux 6.8.0-45-generic`. */
export function osText(platform: NodeJS.Platform, systemVersion: string, kernel: string): string {
  switch (platform) {
    case 'darwin':
      return `macOS ${systemVersion}`
    case 'win32':
      return `Windows ${systemVersion}`
    case 'linux':
      return `Linux ${kernel}`
    default:
      return `${platform} ${systemVersion}`
  }
}

/** One field of `/etc/os-release`, unquoted, or null. */
function osReleaseField(text: string, field: string): string | null {
  const match = new RegExp(`^${field}=(.*)$`, 'm').exec(text)
  return match?.[1]?.trim().replace(/^"(.*)"$/, '$1') ?? null
}

/**
 * Linux's extra rows: distro, display server, desktop and packaging. Each says `unknown` rather
 * than guessing; on any other platform there are none.
 *
 * Packaging is `dev` for a run that was never packaged. A packaged one says which of AppImage,
 * Flatpak and Snap it runs under, since each sets a variable of its own; a .deb, an .rpm and a
 * tarball set none, so they say `unknown`.
 */
export function linuxRows(input: {
  platform: NodeJS.Platform
  env: Readonly<Record<string, string | undefined>>
  osRelease: string | null
  /** Electron's `app.isPackaged`. */
  packaged: boolean
}): [string, string][] {
  if (input.platform !== 'linux') return []
  const { env, osRelease } = input
  const distro = (osRelease === null ? null : osReleaseField(osRelease, 'PRETTY_NAME')) ?? 'unknown'
  const display =
    env['WAYLAND_DISPLAY'] !== undefined || env['XDG_SESSION_TYPE'] === 'wayland'
      ? 'Wayland'
      : env['XDG_SESSION_TYPE'] === 'x11' || env['DISPLAY'] !== undefined
        ? 'X11'
        : 'unknown'
  const packaging = !input.packaged
    ? 'dev'
    : env['APPIMAGE'] !== undefined
      ? 'AppImage'
      : env['FLATPAK_ID'] !== undefined
        ? 'Flatpak'
        : env['SNAP'] !== undefined
          ? 'Snap'
          : 'unknown'
  return [
    ['Distro', distro],
    ['Display', display],
    ['Desktop', env['XDG_CURRENT_DESKTOP'] ?? 'unknown'],
    ['Packaging', packaging],
  ]
}
