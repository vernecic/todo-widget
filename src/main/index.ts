import { app, BrowserWindow, ipcMain, Menu, nativeImage, Notification, powerMonitor, screen, Tray } from 'electron'
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { rename, writeFile } from 'fs/promises'
import { join } from 'path'
import type { ReminderNotice, WindowMode, WindowState } from '../shared/api'

// Keep data in %APPDATA%\todo-app regardless of product name.
app.setPath('userData', join(app.getPath('appData'), 'todo-app'))

const APP_ID = 'com.vid.todo'
const dataDir = app.getPath('userData')
const dataFile = join(dataDir, 'data.json')
const backupFile = join(dataDir, 'data.backup.json')
const stateFile = join(dataDir, 'window.json')

interface Bounds {
  x?: number
  y?: number
  width: number
  height: number
}

interface SavedState {
  mode: WindowMode
  pinned: boolean
  theme: 'light' | 'dark'
  normal: Bounds
  widget: Bounds
}

const BG = { light: '#f7f5f1', dark: '#1d1d21' }

let win: BrowserWindow | null = null
let tray: Tray | null = null
let quitting = false
let flushed = false
let state = loadState()
const liveNotices = new Set<Notification>()

function loadState(): SavedState {
  const fallback: SavedState = {
    mode: 'normal',
    pinned: true,
    theme: 'light',
    normal: { width: 460, height: 720 },
    widget: { width: 330, height: 520 }
  }
  try {
    return { ...fallback, ...JSON.parse(readFileSync(stateFile, 'utf8')) }
  } catch {
    return fallback
  }
}

let stateTimer: NodeJS.Timeout | undefined
function saveState(): void {
  clearTimeout(stateTimer)
  stateTimer = setTimeout(() => {
    try {
      mkdirSync(dataDir, { recursive: true })
      writeFileSync(stateFile, JSON.stringify(state))
    } catch {
      // window position is not worth crashing over
    }
  }, 300)
}

function iconPath(): string {
  return app.isPackaged ? join(process.resourcesPath, 'icon.png') : join(__dirname, '../../resources/icon.png')
}

/** Drop a saved position if it no longer lands on any connected display. */
function onScreen(b: Bounds): Bounds {
  if (b.x === undefined || b.y === undefined) return { width: b.width, height: b.height }
  const { x, y } = b
  const ok = screen.getAllDisplays().some(({ workArea: a }) => {
    return x < a.x + a.width - 60 && x + b.width > a.x + 60 && y >= a.y - 10 && y < a.y + a.height - 60
  })
  return ok ? b : { width: b.width, height: b.height }
}

function boundsFor(mode: WindowMode): Bounds {
  const b = onScreen(state[mode])
  if (mode === 'widget' && b.x === undefined) {
    const a = screen.getPrimaryDisplay().workArea
    return { ...b, x: a.x + a.width - b.width - 24, y: a.y + 24 }
  }
  return b
}

function windowState(): WindowState {
  return { mode: state.mode, pinned: state.pinned }
}

function sendState(): void {
  win?.webContents.send('win:state', windowState())
}

function createWindow(): void {
  const b = boundsFor(state.mode)
  win = new BrowserWindow({
    ...b,
    minWidth: 280,
    minHeight: 300,
    frame: false,
    show: false,
    backgroundColor: BG[state.theme],
    icon: iconPath(),
    alwaysOnTop: state.mode === 'widget' && state.pinned,
    skipTaskbar: state.mode === 'widget',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      backgroundThrottling: false
    }
  })
  if (b.x === undefined) win.center()

  win.once('ready-to-show', () => win?.show())
  win.on('close', (e) => {
    if (!quitting) {
      e.preventDefault()
      win?.hide()
    }
  })
  const remember = (): void => {
    if (!win || win.isMinimized() || win.isMaximized() || win.isFullScreen()) return
    state[state.mode] = win.getBounds()
    saveState()
  }
  win.on('resize', remember)
  win.on('move', remember)

  if (process.env['ELECTRON_RENDERER_URL']) win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  else win.loadFile(join(__dirname, '../renderer/index.html'))
}

function showWindow(): void {
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

function setMode(mode: WindowMode): void {
  if (!win || state.mode === mode) return
  if (win.isMaximized()) win.unmaximize()
  state[state.mode] = win.getBounds()
  state.mode = mode
  const b = boundsFor(mode)
  win.setAlwaysOnTop(mode === 'widget' && state.pinned)
  win.setSkipTaskbar(mode === 'widget')
  win.setBounds(b)
  if (b.x === undefined) win.center()
  saveState()
  sendState()
  buildTrayMenu()
}

function setPinned(pinned: boolean): void {
  state.pinned = pinned
  win?.setAlwaysOnTop(state.mode === 'widget' && pinned)
  saveState()
  sendState()
  buildTrayMenu()
}

function buildTrayMenu(): void {
  tray?.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Show', click: showWindow },
      {
        label: state.mode === 'widget' ? 'Switch to window' : 'Switch to widget',
        click: () => {
          setMode(state.mode === 'widget' ? 'normal' : 'widget')
          showWindow()
        }
      },
      {
        label: 'Widget always on top',
        type: 'checkbox',
        checked: state.pinned,
        click: (item) => setPinned(item.checked)
      },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() }
    ])
  )
}

function createTray(): void {
  const image = nativeImage.createFromPath(iconPath()).resize({ width: 16, height: 16 })
  tray = new Tray(image)
  tray.setToolTip('Todo')
  tray.on('click', showWindow)
  buildTrayMenu()
}

function readJson(file: string): string | null {
  try {
    const text = readFileSync(file, 'utf8')
    JSON.parse(text)
    return text
  } catch {
    return null
  }
}

// Writes are chained so a slow write never lands after a newer one.
let writeChain: Promise<void> = Promise.resolve()
function writeData(json: string): Promise<void> {
  writeChain = writeChain.then(async () => {
    mkdirSync(dataDir, { recursive: true })
    const tmp = `${dataFile}.tmp`
    await writeFile(tmp, json, 'utf8')
    await rename(tmp, dataFile)
  })
  return writeChain
}

function registerIpc(): void {
  ipcMain.handle('data:load', () => readJson(dataFile) ?? readJson(backupFile))
  ipcMain.handle('data:save', (_e, json: string) => writeData(json))
  ipcMain.handle('win:getState', () => windowState())
  ipcMain.on('win:setMode', (_e, mode: WindowMode) => setMode(mode))
  ipcMain.on('win:setPinned', (_e, pinned: boolean) => setPinned(pinned))
  ipcMain.on('win:minimize', () => win?.minimize())
  ipcMain.on('win:hide', () => win?.hide())
  ipcMain.on('win:present', () => {
    if (!win) return
    if (win.isMinimized()) win.restore()
    if (!win.isVisible()) win.showInactive()
  })
  ipcMain.on('win:theme', (_e, theme: 'light' | 'dark') => {
    state.theme = theme
    win?.setBackgroundColor(BG[theme])
    saveState()
  })
  ipcMain.on('notify', (_e, notice: ReminderNotice) => {
    if (!Notification.isSupported()) return
    const n = new Notification({ title: notice.title, body: notice.body, icon: iconPath() })
    // Hold a reference, otherwise the click handler can be garbage collected.
    liveNotices.add(n)
    n.on('click', () => {
      showWindow()
      if (notice.taskId) win?.webContents.send('task:focus', notice.taskId)
      liveNotices.delete(n)
    })
    n.on('close', () => liveNotices.delete(n))
    n.show()
  })
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', showWindow)

  app.whenReady().then(() => {
    app.setAppUserModelId(app.isPackaged ? APP_ID : process.execPath)
    // Keep one known-good copy of the previous session's data.
    if (readJson(dataFile)) {
      try {
        copyFileSync(dataFile, backupFile)
      } catch {
        // backup is best effort
      }
    }
    registerIpc()
    createWindow()
    createTray()
    // Running timers pause when the user steps away.
    powerMonitor.on('lock-screen', () => win?.webContents.send('power:away', 'lock'))
    powerMonitor.on('suspend', () => win?.webContents.send('power:away', 'sleep'))
  })

  // Give the renderer a moment to write pending changes before exiting.
  app.on('before-quit', (e) => {
    quitting = true
    if (flushed || !win || win.webContents.isDestroyed()) return
    e.preventDefault()
    const done = (): void => {
      if (flushed) return
      flushed = true
      app.quit()
    }
    ipcMain.once('app:flushed', done)
    setTimeout(done, 1500)
    win.webContents.send('app:flush')
  })

  app.on('window-all-closed', () => app.quit())
}
