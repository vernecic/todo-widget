import type { AppData, CheckIn, Counter, Project, Series, Session, Settings, Tally, Task } from './types'

/**
 * Where app data lives. Today it is a local JSON file; a Supabase adapter can
 * implement the same interface later. Every record carries a UUID and an
 * updatedAt timestamp so records can be merged during sync.
 */
export interface StorageAdapter {
  load(): Promise<AppData | null>
  save(data: AppData): Promise<void>
}

/** Counters a new install starts with. Older files stored their values by position, in this order. */
const DEFAULT_TARGETS = [100, 50, 20]
const legacyCounterId = (i: number): string => `counter-${i}`

function defaultCounters(): Counter[] {
  const now = new Date().toISOString()
  return DEFAULT_TARGETS.map((target, i) => ({ id: legacyCounterId(i), target, updatedAt: now }))
}

export function emptyData(): AppData {
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches
  return {
    version: 1,
    tasks: [],
    series: [],
    projects: [],
    counters: defaultCounters(),
    tallies: [],
    checkIns: [],
    sessions: [],
    settings: {
      theme: dark ? 'dark' : 'light',
      doneCollapsed: false,
      collapsed: { work: false, free: false },
      addCategory: 'work',
      workCheckDate: null,
      checkInHour: null,
      awayPause: null
    }
  }
}

/** Fill in fields that older files may be missing. */
interface RawData {
  tasks?: Partial<Task>[]
  series?: Partial<Series>[]
  projects?: Project[]
  counters?: Counter[]
  tallies?: (Omit<Tally, 'values'> & { values: Tally['values'] | number[] })[]
  checkIns?: Partial<CheckIn>[]
  sessions?: Session[]
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
  paused: false,
  priority: 0
}

function normalize(raw: RawData): AppData {
  const base = emptyData()
  return {
    version: 1,
    tasks: (raw.tasks ?? []).map((t) => {
      const task = { ...TASK_DEFAULTS, ...t } as Task
      // Older files allowed several "doing" tasks with no timer: they become paused.
      if (task.doing && !raw.sessions?.some((s) => s.taskId === task.id && s.end === null)) {
        task.doing = false
        task.paused = !task.done
      }
      return task
    }),
    series: (raw.series ?? []).map((s) => ({ skipDates: [], endDate: null, subtasks: [], category: 'work', ...s }) as Series),
    projects: raw.projects ?? [],
    counters: raw.counters ?? defaultCounters(),
    tallies: (raw.tallies ?? []).map((t) => ({
      ...t,
      values: Array.isArray(t.values)
        ? Object.fromEntries(t.values.map((v, i) => [legacyCounterId(i), v]))
        : t.values
    })),
    checkIns: (raw.checkIns ?? []).map((c) => ({ taskId: null, ...c }) as CheckIn),
    sessions: raw.sessions ?? [],
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
