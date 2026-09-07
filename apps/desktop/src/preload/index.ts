import electron from 'electron'

const { ipcRenderer } = electron

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
