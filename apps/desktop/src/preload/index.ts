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
 * The one thing the page may ask the main process to do.
 *
 * Deliberately a single method that takes nothing and returns nothing: the renderer can ask to be
 * replaced and can say nothing else through this channel. Exposed with `contextBridge` rather than
 * by listening for a window message, because a message listener is open to anything running in the
 * page and this is not.
 */
contextBridge.exposeInMainWorld('sessionWindow', {
  recycle: () => ipcRenderer.invoke('session-recycle-window'),
})
