import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Electron's module is CommonJS, and the ESM loader cannot see named exports through it.
// The default import plus a destructure is the form that works under both loaders.
import electron from 'electron'

const { app, BrowserWindow, MessageChannelMain, ipcMain } = electron

import { createBridge } from './bridge'

/**
 * The main process owns the bridge.
 *
 * libsession lives here rather than in the renderer because this is where the database key,
 * the user-data directory and the shutdown ordering already are — and because a renderer
 * cannot load a native addon anyway. The renderer only ever sees an ordered stream of
 * frames over a MessagePort, so moving the bridge into a utility process later would not
 * change a line of it.
 */

const here = fileURLToPath(new URL('.', import.meta.url))

async function createWindow(): Promise<void> {
  const bridge = await createBridge()

  const window = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 380,
    // Shown straight away rather than on ready-to-show: that event is not dependable on a
    // headless display, and a window that never shows has no layout, which makes every
    // element in it invisible to a test.
    show: true,
    webPreferences: {
      preload: join(here, '../preload/index.mjs'),
      sandbox: false,
    },
  })

  // One MessagePort, which is FIFO: libsession's ordering survives the process boundary,
  // which is the whole reason responses and events share a single stream.
  const { port1, port2 } = new MessageChannelMain()

  bridge.setSink((frame) => {
    port1.postMessage(frame)
  })
  port1.on('message', (event: { data: Uint8Array }) => {
    bridge.send(new Uint8Array(event.data))
  })
  port1.start()

  window.webContents.once('did-finish-load', () => {
    window.webContents.postMessage('session-bridge-port', null, [port2])
  })

  window.on('closed', () => {
    bridge.close()
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    await window.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    await window.loadFile(join(here, '../renderer/index.html'))
  }
}

void app.whenReady().then(async () => {
  ipcMain.handle('session-ping', () => 'pong')
  await createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
