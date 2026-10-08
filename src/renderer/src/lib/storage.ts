import type { AppData, CheckIn, Project, Series, Settings, Tally, Task } from './types'

/**
 * Where app data lives. Today it is a local JSON file; a Supabase adapter can
 * implement the same interface later. Every record carries a UUID and an
 * updatedAt timestamp so records can be merged during sync.
 */
export interface StorageAdapter {
  load(): Promise<AppData | null>
  save(data: AppData): Promise<void>
}

export function emptyData(): AppData {
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches
  return {
    version: 1,
    tasks: [],
    series: [],
    projects: [],
    tallies: [],
    checkIns: [],
    settings: {
      theme: dark ? 'dark' : 'light',
      doneCollapsed: false,
      collapsed: { work: false, free: false },
      addCategory: 'work',
      workCheckDate: null,
      checkInHour: null
    }
  }
}

/** Fill in fields that older files may be missing. */
interface RawData {
  tasks?: Partial<Task>[]
  series?: Partial<Series>[]
  projects?: Project[]
  tallies?: Tally[]
  checkIns?: CheckIn[]
  settings?: Partial<Settings>
}

const TASK_DEFAULTS: Partial<Task> = {
  notes: '',
  subtasks: [],
  reminder: null,
  remindedKey: null,
  seriesId: null,
  occurrence: null,
  rolledFrom: null,
  projectId: null,
  category: 'work',
  doneAt: null,
  doing: false,
  priority: 0
}

function normalize(raw: RawData): AppData {
  const base = emptyData()
  return {
    version: 1,
    tasks: (raw.tasks ?? []).map((t) => ({ ...TASK_DEFAULTS, ...t }) as Task),
    series: (raw.series ?? []).map((s) => ({ skipDates: [], endDate: null, subtasks: [], category: 'work', ...s }) as Series),
    projects: raw.projects ?? [],
    tallies: raw.tallies ?? [],
    checkIns: raw.checkIns ?? [],
    settings: { ...base.settings, ...raw.settings }
  }
}

export const localFileStorage: StorageAdapter = {
  async load() {
    const text = await window.api.loadData()
    return text ? normalize(JSON.parse(text)) : null
  },
  save(data) {
    return window.api.saveData(JSON.stringify(data, null, 1))
  }
}
