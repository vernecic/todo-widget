import type { AppData, CheckIn, Counter, Note, Project, Series, Session, Settings, Tally, Task } from './types'

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
  return DEFAULT_TARGETS.map((target, i) => ({ id: legacyCounterId(i), name: `Counter ${i + 1}`, target, updatedAt: now }))
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
    notes: [],
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
  counters?: (Omit<Counter, 'name'> & { name?: string })[]
  tallies?: (Omit<Tally, 'values' | 'targets'> & { values: Tally['values'] | number[]; targets?: Tally['targets'] })[]
  checkIns?: Partial<CheckIn>[]
  sessions?: Session[]
  notes?: Note[]
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
      // "Doing" always matches the running timer. Older files allowed several doing tasks with no timer: they become paused.
      const timing = !task.done && !!raw.sessions?.some((s) => s.taskId === task.id && s.end === null)
      if (task.doing && !timing) task.paused = !task.done
      task.doing = timing
      if (timing) task.paused = false
      return task
    }),
    series: (raw.series ?? []).map((s) => ({ skipDates: [], endDate: null, subtasks: [], category: 'work', ...s }) as Series),
    projects: raw.projects ?? [],
    counters: raw.counters?.map((c, i) => ({ ...c, name: c.name ?? `Counter ${i + 1}` })) ?? defaultCounters(),
    tallies: (raw.tallies ?? []).map((t) => ({
      ...t,
      targets: t.targets ?? {},
      values: Array.isArray(t.values)
        ? Object.fromEntries(t.values.map((v, i) => [legacyCounterId(i), v]))
        : t.values
    })),
    checkIns: (raw.checkIns ?? []).map((c) => ({ taskId: null, ...c }) as CheckIn),
    sessions: raw.sessions ?? [],
    notes: raw.notes ?? [],
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
