import { useSyncExternalStore } from 'react'
import { emptyData, localFileStorage, type StorageAdapter } from './storage'
import type { AppData } from './types'

const storage: StorageAdapter = localFileStorage

let data: AppData = emptyData()
const listeners = new Set<() => void>()
let saveTimer: number | undefined
let dirty = false

export const getData = (): AppData => data

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useData(): AppData {
  return useSyncExternalStore(subscribe, getData)
}

/** Apply a change to a copy of the data, re-render and schedule a save. */
export function mutate(fn: (draft: AppData) => void): void {
  const next = structuredClone(data)
  fn(next)
  data = next
  listeners.forEach((l) => l())
  dirty = true
  window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(saveNow, 250)
}

/** Set when the data file exists but could not be read; saving is then blocked so it is not overwritten. */
export let loadError: string | null = null

export async function saveNow(): Promise<void> {
  window.clearTimeout(saveTimer)
  if (!dirty || loadError) return
  dirty = false
  await storage.save(data)
}

export async function loadStore(): Promise<void> {
  try {
    const loaded = await storage.load()
    if (loaded) data = loaded
  } catch (err) {
    loadError = String(err)
  }
}

export const uid = (): string => crypto.randomUUID()
export const stamp = (): string => new Date().toISOString()
