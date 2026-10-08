import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import type { Api } from '../shared/api'

function on<T extends unknown[]>(channel: string, cb: (...args: T) => void): () => void {
  const listener = (_e: IpcRendererEvent, ...args: unknown[]): void => cb(...(args as T))
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: Api = {
  loadData: () => ipcRenderer.invoke('data:load'),
  saveData: (json) => ipcRenderer.invoke('data:save', json),
  getWindowState: () => ipcRenderer.invoke('win:getState'),
  setMode: (mode) => ipcRenderer.send('win:setMode', mode),
  setPinned: (pinned) => ipcRenderer.send('win:setPinned', pinned),
  minimize: () => ipcRenderer.send('win:minimize'),
  hide: () => ipcRenderer.send('win:hide'),
  setTheme: (theme) => ipcRenderer.send('win:theme', theme),
  notify: (notice) => ipcRenderer.send('notify', notice),
  present: () => ipcRenderer.send('win:present'),
  flushed: () => ipcRenderer.send('app:flushed'),
  onWindowState: (cb) => on('win:state', cb),
  onFocusTask: (cb) => on('task:focus', cb),
  onFlush: (cb) => on('app:flush', cb)
}

contextBridge.exposeInMainWorld('api', api)
