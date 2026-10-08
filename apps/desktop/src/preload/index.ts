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
 * `setLocale` is for what main draws itself, the right-click menu. `restart` is the only way the
 * page can end its own process.
 */
contextBridge.exposeInMainWorld('sessionDesktop', {
  openExternal: (url: string) => {
    ipcRenderer.send('open-external', url)
  },
  /**
   * Where a file should go, and showing somebody where it went.
   *
   * `invoke` rather than `send` because both answer: the chosen path, and whether main revealed
   * it or refused.
   */
  chooseExportLocation: (suggestedName: string): Promise<string | null> =>
    ipcRenderer.invoke('files:choose-export-location', suggestedName),
  revealInFolder: (path: string): Promise<boolean> => ipcRenderer.invoke('files:reveal', path),
  copyText: (text: string): Promise<void> => ipcRenderer.invoke('clipboard-write-text', text),
  setLocale: (locale: string) => {
    ipcRenderer.send('locale', locale)
  },
  restart: () => {
    ipcRenderer.send('restart')
  },
  /**
   * The log: one call to learn the pseudonym salt and what main knows about the machine, and one
   * to hand over finished lines. Main owns the files; the page only ever appends.
   */
  openLog: (): Promise<unknown> => ipcRenderer.invoke('log:open'),
  appendLog: (lines: string[], urgent: boolean) => {
    ipcRenderer.send('log:append', lines, urgent)
  },
})
