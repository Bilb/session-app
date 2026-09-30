import electron from 'electron'

const { contextBridge, ipcRenderer } = electron

/**
 * Hands the bridge's MessagePort to the page and steps aside.
 *
 * The main process posts the port here because a preload is the only script that can receive
 * one over IPC; the page is the only place that should hold it, because a frame that crossed
 * through the preload would be copied a second time on the way between worlds. So the port goes
 * straight into the main world and the renderer's transport picks it up off `window`.
 *
 * Nothing here needs Node, which is what lets the renderer run sandboxed.
 */
ipcRenderer.on('session-bridge-port', (event) => {
  window.postMessage('session-bridge-port', '*', event.ports)
})

/**
 * The whole of what the page may ask for: one argument each, checked by the main process.
 *
 * `openExternal` exists because the window-open handler refuses everything, so the app needs a way
 * to say "this one, and I meant it" that a `target="_blank"` in content we did not write cannot
 * reach. `copyText` exists because every permission is refused, the clipboard's included.
 * `setLocale` is for what main draws itself, the right-click menu.
 */
contextBridge.exposeInMainWorld('sessionDesktop', {
  openExternal: (url: string) => {
    ipcRenderer.send('open-external', url)
  },
  copyText: (text: string): Promise<void> => ipcRenderer.invoke('clipboard-write-text', text),
  setLocale: (locale: string) => {
    ipcRenderer.send('locale', locale)
  },
})
