import { useSyncExternalStore } from 'react'

/** Tiny observable for UI overlays (dialog, context menu) that live outside the data store. */
function createSlot<T>(initial: T) {
  let value = initial
  const listeners = new Set<() => void>()
  return {
    get: () => value,
    set(next: T) {
      value = next
      listeners.forEach((l) => l())
    },
    use(): T {
      return useSyncExternalStore(
        (l) => {
          listeners.add(l)
          return () => listeners.delete(l)
        },
        () => value
      )
    }
  }
}

// ---------- confirm / prompt dialog ----------

export interface DialogButton {
  id: string
  label: string
  kind?: 'primary' | 'danger'
}

export interface DialogRequest {
  title: string
  message?: string
  input?: { placeholder: string }
  buttons: DialogButton[]
}

export interface DialogResult {
  button: string | null
  value: string
}

interface OpenDialog extends DialogRequest {
  resolve: (r: DialogResult) => void
}

export const dialogSlot = createSlot<OpenDialog | null>(null)

export function ask(request: DialogRequest): Promise<DialogResult> {
  return new Promise((resolve) => dialogSlot.set({ ...request, resolve }))
}

// ---------- context menu ----------

export type MenuItem =
  | { kind?: 'action'; label: string; onSelect: () => void; danger?: boolean }
  | { kind: 'date'; label: string; value: string; onPick: (date: string) => void }
  | { kind: 'separator' }

export interface OpenMenu {
  x: number
  y: number
  items: MenuItem[]
}

export const menuSlot = createSlot<OpenMenu | null>(null)

export function openMenu(e: { clientX: number; clientY: number; preventDefault(): void }, items: MenuItem[]): void {
  e.preventDefault()
  menuSlot.set({ x: e.clientX, y: e.clientY, items })
}
