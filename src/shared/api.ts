export type WindowMode = 'normal' | 'widget'

export interface WindowState {
  mode: WindowMode
  pinned: boolean
}

export interface ReminderNotice {
  /** Task to open when the notification is clicked. */
  taskId?: string
  title: string
  body: string
}

/** Bridge exposed by the preload script as `window.api`. */
export interface Api {
  loadData(): Promise<string | null>
  saveData(json: string): Promise<void>
  getWindowState(): Promise<WindowState>
  setMode(mode: WindowMode): void
  setPinned(pinned: boolean): void
  minimize(): void
  hide(): void
  setTheme(theme: 'light' | 'dark'): void
  notify(notice: ReminderNotice): void
  /** Bring a hidden or minimized window back into view without taking focus. */
  present(): void
  flushed(): void
  onWindowState(cb: (state: WindowState) => void): () => void
  onFocusTask(cb: (taskId: string) => void): () => void
  onFlush(cb: () => void): () => void
}
