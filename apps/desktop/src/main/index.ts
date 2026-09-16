import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// Electron's module is CommonJS, and the ESM loader cannot see named exports through it.
// The default import plus a destructure is the form that works under both loaders.
import electron from 'electron'

const { app, BrowserWindow, MessageChannelMain, ipcMain, session, shell } = electron

import type { Request } from '@session/client'

import { createBridge } from './bridge'
import {
  applyContentProtection,
  denyAllPermissions,
  guardNavigation,
  hardenedWebPreferences,
  refuseNewContents,
} from './security'

/**
 * The main process owns the bridge.
 *
 * libsession lives here rather than in the renderer because this is where the database key,
 * the user-data directory and the shutdown ordering already are - and because a renderer
 * cannot load a native addon anyway. The renderer only ever sees an ordered stream of
 * frames over a MessagePort, so moving the bridge into a utility process later would not
 * change a line of it.
 */

/**
 * What the app calls itself, which decides where its data lives.
 *
 * Without this it is "Electron": `app.getName()` falls back to that, so the database lands in
 * `~/.config/Electron` beside every other Electron project on the machine - and the scoped
 * package name grows a second, half-used `~/.config/@session/desktop` next to it. Set before
 * anything reads a path, because `userData` is resolved on first use and then fixed.
 *
 * Deliberately not "Session": the shipped client already owns that directory, and a dev build
 * that opened the real client's data would be a bad afternoon. A placeholder until somebody
 * decides on branding, not a name anyone chose.
 */
app.setName('session-app')

const here = fileURLToPath(new URL('.', import.meta.url))

/**
 * The bridge, which outlives any particular window.
 *
 * It used to be built inside `createWindow` and closed when that window closed, which held
 * together only because there was exactly one window. It is not the same thing as the window:
 * `app.on('activate')` below opens another when the last one has gone, which on macOS is the
 * ordinary way an app comes back from the dock -- and that reopened libsession's database rather
 * than carrying on with the one already open.
 *
 * So it is built once, every window is wired to it, and it is closed when the app quits.
 */
let bridge: Awaited<ReturnType<typeof createBridge>> | null = null

async function requireBridge(): Promise<NonNullable<typeof bridge>> {
  bridge ??= await createBridge()
  return bridge
}

async function createWindow({ show = true } = {}): Promise<Electron.BrowserWindow> {
  const open = await requireBridge()

  const window = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 380,
    /**
     * Small enough to be useful, tall enough that onboarding still fits.
     *
     * The wide onboarding column is a fixed block -- a 30 header, a 12 gap, the 276 every step
     * reserves so none of them jumps, and 12 either side of the lot. **Measured against the
     * running renderer, it stops fitting below a 340 viewport**: at 340 it fills the height
     * exactly, and at 320 the Session wordmark is 10 points off the top of the screen.
     *
     * `useContentSize` is not set, so this is the whole window and the frame comes out of it --
     * about 28 on macOS. 380 leaves the content a dozen points of slack on top of the 340 and
     * squares with `minWidth`. A product call: a floor on the window rather than
     * letting the column scroll, since a registration form that scrolls is worse than one that
     * cannot be made silly-small.
     */
    minHeight: 380,
    // Linux and Windows take the window icon from here; macOS ignores it and uses the bundle's,
    // which is the packager's job rather than this file's.
    icon: join(here, '../../resources/icon.png'),
    // Shown straight away rather than on ready-to-show: that event is not dependable on a
    // headless display, and a window that never shows has no layout, which makes every
    // element in it invisible to a test. A replacement window is the exception -- it is loaded
    // hidden and shown only once it has painted, which is what makes the swap not a flash.
    show,
    webPreferences: {
      ...hardenedWebPreferences({ packaged: app.isPackaged }),
      // CommonJS, because a sandboxed preload cannot be an ES module; it is built that way in
      // electron.vite.config.ts. The preload needs nothing from Node, so the sandbox costs nothing.
      preload: join(here, '../preload/index.cjs'),
    },
  })

  // The dev server when electron-vite sets it, the built file otherwise. Resolved once because
  // the navigation guard has to allow exactly what the window is about to load: computing it
  // twice is how the guard comes to refuse the app's own reload.
  const appUrl =
    process.env['ELECTRON_RENDERER_URL'] ??
    pathToFileURL(join(here, '../renderer/index.html')).toString()

  guardNavigation(window.webContents, appUrl)
  applyContentProtection(window, process.platform)

  /**
   * Links leave for the person's own browser rather than opening a window here.
   *
   * Without this, `window.open` gets an Electron `BrowserWindow` -- a chromeless frame with no
   * address bar, no extensions and none of the browser's own protections, showing a page the app
   * told you it was handing to your browser. Denying and shelling out is the only honest reading
   * of "this will open in your browser", and it is the standard Electron shape for the same reason.
   *
   * Restricted to http(s): `openExternal` will hand any scheme to the OS, and a `file:` or a
   * custom scheme reaching it is how a link turns into a launched program.
   */
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  // One MessagePort, which is FIFO: libsession's ordering survives the process boundary,
  // which is the whole reason responses and events share a single stream.
  let port: InstanceType<typeof MessageChannelMain>['port1'] | null = null

  // A channel per load: transferring port2 neuters it, so a reloaded document needs a new one.
  function openChannel(): void {
    port?.close()
    const { port1, port2 } = new MessageChannelMain()
    port = port1

    // A frame is a plain object built by the addon; structured clone carries it to the renderer.
    open.setSink((frame) => {
      port?.postMessage(frame)
    })
    port1.on('message', (event: { data: unknown }) => {
      // Renderer input: an exception escaping here is an uncaught one in the main process.
      try {
        open.send(event.data as Request)
      } catch {
        // No id to answer on, so there is nobody to tell.
      }
    })
    port1.start()
    window.webContents.postMessage('session-bridge-port', null, [port2])
  }

  window.webContents.on('did-finish-load', openChannel)

  // **The port, and not the bridge.** The port is this window's, and nothing loads after a close
  // to retire it, so without this the last one of every window stays open. The bridge is the
  // app's -- a window being replaced must not take libsession down with the outgoing one -- and it
  // is closed on 'before-quit'.
  window.on('closed', () => {
    port?.close()
    port = null
  })

  await window.loadURL(appUrl)

  return window
}

/**
 * Replaces the window with a fresh one, and with it the renderer process.
 *
 * **The point is the process, not the page.** A reload tears down the document and the JavaScript
 * context but keeps the same renderer process -- measured: the pid is unchanged either side -- so
 * nothing typed into it is actually freed on our schedule. A new window is a new process, and when
 * the old one goes its heap goes with it, including the strings a recovery phrase leaves behind
 * that JavaScript gives no way to wipe.
 *
 * Staged so it is not a flash: the replacement is created hidden, loaded, and shown in the same
 * beat that the old one closes, with the same bounds. What the person should see is the content
 * changing, which it was about to do anyway.
 */
async function recycleWindow(): Promise<void> {
  const previous = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  if (!previous) return

  const bounds = previous.getBounds()
  const next = await createWindow({ show: false })
  next.setBounds(bounds)
  next.show()
  // Destroy rather than close: `close` is cancellable and fires the same lifecycle a person
  // quitting would, and this is neither a person nor a quit.
  previous.destroy()
}

// Covers any WebContents the app did not make. Deliberately not guardNavigation: this fires from
// inside `new BrowserWindow`, before the window has a URL, so a navigation guard installed here
// could only refuse every navigation - including the app's own reload. createWindow installs that
// half itself, once it knows what the app's URL is.
app.on('web-contents-created', (_event, contents) => {
  refuseNewContents(contents)
})

void app.whenReady().then(async () => {
  denyAllPermissions(session.defaultSession)
  ipcMain.handle('session-ping', () => 'pong')
  // No arguments and no return: the renderer can ask to be replaced and can say nothing else
  // through it, which is the whole surface.
  ipcMain.handle('session-recycle-window', async () => {
    await recycleWindow()
  })
  await createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// The bridge outlives every window, so it is closed here rather than with one of them.
app.on('before-quit', () => {
  bridge?.close()
  bridge = null
})
