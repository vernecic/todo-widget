export type Priority = 0 | 1 | 2 | 3

export interface Subtask {
  id: string
  title: string
  done: boolean
}

/** Which list a task belongs to. */
export type Category = 'work' | 'free'

/** Where a task stands: not started, being worked on, or finished. */
export type Status = 'todo' | 'doing' | 'done'

export type Repeat = { kind: 'daily' } | { kind: 'weekly'; days: number[] }

export interface Task {
  id: string
  title: string
  notes: string
  /** Day the task is shown on, YYYY-MM-DD. */
  date: string
  order: number
  priority: Priority
  projectId: string | null
  category: Category
  done: boolean
  doneAt: string | null
  /** Being worked on right now. Always false once the task is done. */
  doing: boolean
  subtasks: Subtask[]
  /** Reminder time HH:MM on the task's day. */
  reminder: string | null
  /** `${date} ${time}` of the last reminder shown, so it fires once. */
  remindedKey: string | null
  seriesId: string | null
  /** Which occurrence of the series this task is (stays fixed if the task is moved). */
  occurrence: string | null
  /** Original date when an unfinished task rolled forward. */
  rolledFrom: string | null
  createdAt: string
  updatedAt: string
}

/** Template for a recurring task. Instances are created per day as they are needed. */
export interface Series {
  id: string
  title: string
  notes: string
  priority: Priority
  projectId: string | null
  category: Category
  subtasks: string[]
  reminder: string | null
  repeat: Repeat
  startDate: string
  /** Exclusive: no occurrences on or after this date. */
  endDate: string | null
  skipDates: string[]
  updatedAt: string
}

export interface Project {
  id: string
  name: string
  color: number
  updatedAt: string
}

/** One day's values for the unnamed counters in Free time (targets in COUNTER_TARGETS). */
export interface Tally {
  id: string
  date: string
  values: number[]
  updatedAt: string
}

/** Answer to the hourly "What are you doing?" prompt. Empty text means it was skipped. */
export interface CheckIn {
  id: string
  date: string
  /** HH:MM; the hour the prompt was for, or the time of a manual entry. */
  time: string
  text: string
  createdAt: string
  updatedAt: string
}

export interface Settings {
  theme: 'light' | 'dark'
  doneCollapsed: boolean
  collapsed: Record<Category, boolean>
  /** List the add bar puts new tasks in. */
  addCategory: Category
  /** Day the 16:00 work check last ran, so it asks once. */
  workCheckDate: string | null
  /** `${date} ${HH}` of the last hourly check-in, so each hour asks once. */
  checkInHour: string | null
}

export interface AppData {
  version: 1
  tasks: Task[]
  series: Series[]
  projects: Project[]
  tallies: Tally[]
  checkIns: CheckIn[]
  settings: Settings
}
