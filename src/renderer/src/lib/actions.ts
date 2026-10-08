import { addDays, minutesOf, nowTime, todayKey, weekday } from './dates'
import { PROJECT_COLORS } from './colors'
import { getData, mutate, stamp, uid } from './store'
import type { AppData, Category, Priority, Project, Repeat, Series, Status, Subtask, Task } from './types'

// ---------- helpers ----------

export const CATEGORY_LABEL: Record<Category, string> = { work: 'Work', free: 'Free time' }
export const CATEGORIES: Category[] = ['work', 'free']

const find = (d: AppData, id: string): Task | undefined => d.tasks.find((t) => t.id === id)

function touch(t: { updatedAt: string }): void {
  t.updatedAt = stamp()
}

function dayTasks(d: AppData, date: string): Task[] {
  return d.tasks.filter((t) => t.date === date)
}

function nextOrder(d: AppData, date: string): number {
  return dayTasks(d, date).reduce((max, t) => Math.max(max, t.order), -1) + 1
}

export function liveSeries(d: AppData, task: Task): Series | undefined {
  return task.seriesId ? d.series.find((s) => s.id === task.seriesId) : undefined
}

function occursOn(s: Series, date: string): boolean {
  if (date < s.startDate) return false
  if (s.endDate && date >= s.endDate) return false
  if (s.skipDates.includes(date)) return false
  return s.repeat.kind === 'daily' || s.repeat.days.includes(weekday(date))
}

function newTask(d: AppData, fields: Partial<Task> & { title: string; date: string }): Task {
  const now = stamp()
  return {
    id: uid(),
    notes: '',
    order: nextOrder(d, fields.date),
    priority: 0,
    projectId: null,
    category: 'work',
    done: false,
    doneAt: null,
    doing: false,
    subtasks: [],
    reminder: null,
    remindedKey: null,
    seriesId: null,
    occurrence: null,
    rolledFrom: null,
    createdAt: now,
    updatedAt: now,
    ...fields
  }
}

/** Finishing or reopening a task also ends "doing"; reopened tasks go back to To do. */
function setDone(t: Task, done: boolean): void {
  t.done = done
  t.doneAt = done ? stamp() : null
  t.doing = false
  touch(t)
}

export const taskStatus = (t: Task): Status => (t.done ? 'done' : t.doing ? 'doing' : 'todo')

export const STATUS_LABEL: Record<Status, string> = { todo: 'To do', doing: 'Doing', done: 'Done' }
export const STATUSES: Status[] = ['todo', 'doing', 'done']

// ---------- projects ----------

function projectByName(d: AppData, name: string): Project | undefined {
  return d.projects.find((p) => p.name.toLowerCase() === name.toLowerCase())
}

function createProject(d: AppData, name: string): Project {
  const p: Project = { id: uid(), name, color: d.projects.length % PROJECT_COLORS.length, updatedAt: stamp() }
  d.projects.push(p)
  return p
}

export function addProject(name: string): string | null {
  const clean = name.trim()
  if (!clean) return null
  let id = projectByName(getData(), clean)?.id ?? null
  if (!id) mutate((d) => (id = createProject(d, clean).id))
  return id
}

export function renameProject(id: string, name: string): void {
  mutate((d) => {
    const p = d.projects.find((x) => x.id === id)
    if (!p) return
    p.name = name
    touch(p)
  })
}

export function cycleProjectColor(id: string): void {
  mutate((d) => {
    const p = d.projects.find((x) => x.id === id)
    if (!p) return
    p.color = (p.color + 1) % PROJECT_COLORS.length
    touch(p)
  })
}

export function deleteProject(id: string): void {
  mutate((d) => {
    d.projects = d.projects.filter((p) => p.id !== id)
    for (const t of d.tasks) if (t.projectId === id) ((t.projectId = null), touch(t))
    for (const s of d.series) if (s.projectId === id) ((s.projectId = null), touch(s))
  })
}

// ---------- recurring ----------

/** Template fields copied between a recurring instance and its series. */
type TemplatePatch = Partial<Pick<Task, 'title' | 'notes' | 'priority' | 'projectId' | 'category' | 'reminder'>>
const TEMPLATE_KEYS = ['title', 'notes', 'priority', 'projectId', 'category', 'reminder'] as const

/** Remove generated future copies nobody has touched, so they regenerate from the template. */
function dropUntouchedFuture(d: AppData, seriesId: string, keepId: string, from: string): void {
  d.tasks = d.tasks.filter(
    (t) =>
      !(
        t.seriesId === seriesId &&
        t.id !== keepId &&
        !t.done &&
        t.createdAt === t.updatedAt &&
        (t.occurrence ?? t.date) > from
      )
  )
}

function syncTemplate(d: AppData, task: Task, patch: TemplatePatch, subtasks?: string[]): void {
  const s = liveSeries(d, task)
  if (!s) return
  for (const key of TEMPLATE_KEYS) if (key in patch) Object.assign(s, { [key]: patch[key] })
  if (subtasks) s.subtasks = subtasks
  touch(s)
  dropUntouchedFuture(d, s.id, task.id, todayKey())
}

function missingInstances(d: AppData, date: string): Series[] {
  return d.series.filter(
    (s) => occursOn(s, date) && !d.tasks.some((t) => t.seriesId === s.id && t.occurrence === date)
  )
}

/** Create the copies of recurring tasks that belong on these days. */
export function ensureInstances(dates: string[]): void {
  const d0 = getData()
  if (!dates.some((date) => missingInstances(d0, date).length)) return
  mutate((d) => {
    for (const date of dates) {
      for (const s of missingInstances(d, date)) {
        d.tasks.push(
          newTask(d, {
            title: s.title,
            date,
            notes: s.notes,
            priority: s.priority,
            projectId: s.projectId,
            category: s.category,
            reminder: s.reminder,
            subtasks: s.subtasks.map((title) => ({ id: uid(), title, done: false })),
            seriesId: s.id,
            occurrence: date
          })
        )
      }
    }
  })
}

export function setRepeat(taskId: string, repeat: Repeat | null): void {
  mutate((d) => {
    const t = find(d, taskId)
    if (!t) return
    const s = liveSeries(d, t)
    if (!repeat) {
      if (!s || !t.occurrence) return
      s.endDate = addDays(t.occurrence, 1)
      touch(s)
      dropUntouchedFuture(d, s.id, t.id, t.occurrence)
      t.seriesId = null
      t.occurrence = null
      touch(t)
      return
    }
    if (s) {
      s.repeat = repeat
      touch(s)
      dropUntouchedFuture(d, s.id, t.id, todayKey())
      return
    }
    const series: Series = {
      id: uid(),
      title: t.title,
      notes: t.notes,
      priority: t.priority,
      projectId: t.projectId,
      category: t.category,
      subtasks: t.subtasks.map((x) => x.title),
      reminder: t.reminder,
      repeat,
      startDate: t.date,
      endDate: null,
      skipDates: [],
      updatedAt: stamp()
    }
    d.series.push(series)
    t.seriesId = series.id
    t.occurrence = t.date
    t.rolledFrom = null
    touch(t)
  })
}

// ---------- tasks ----------

export function addTask(input: {
  title: string
  date: string
  priority: Priority
  project: string | null
  category: Category
}): string {
  let id = ''
  mutate((d) => {
    let projectId: string | null = null
    if (input.project) projectId = (projectByName(d, input.project) ?? createProject(d, input.project)).id
    const t = newTask(d, {
      title: input.title,
      date: input.date,
      priority: input.priority,
      projectId,
      category: input.category
    })
    d.tasks.push(t)
    id = t.id
  })
  return id
}

export function updateTask(id: string, patch: TemplatePatch): void {
  mutate((d) => {
    const t = find(d, id)
    if (!t) return
    Object.assign(t, patch)
    if ('reminder' in patch) t.remindedKey = null
    touch(t)
    syncTemplate(d, t, patch)
  })
}

export function cyclePriority(id: string): void {
  const t = find(getData(), id)
  if (t) updateTask(id, { priority: ((t.priority + 1) % 4) as Priority })
}

export function toggleTask(id: string): void {
  mutate((d) => {
    const t = find(d, id)
    if (t) setDone(t, !t.done)
  })
}

export function setStatus(id: string, status: Status): void {
  mutate((d) => {
    const t = find(d, id)
    if (!t || taskStatus(t) === status) return
    if (status === 'done') return setDone(t, true)
    if (t.done) setDone(t, false)
    t.doing = status === 'doing'
    touch(t)
  })
}

export function moveTask(id: string, date: string): void {
  mutate((d) => {
    const t = find(d, id)
    if (!t || t.date === date) return
    t.order = nextOrder(d, date)
    t.date = date
    t.rolledFrom = null
    touch(t)
  })
}

/** Reorder a day's tasks; `moved` also switches one task to another list. */
export function reorderDay(orderedIds: string[], moved?: { id: string; category: Category }): void {
  mutate((d) => {
    if (moved) {
      const t = find(d, moved.id)
      if (t && t.category !== moved.category) {
        t.category = moved.category
        touch(t)
        syncTemplate(d, t, { category: moved.category })
      }
    }
    orderedIds.forEach((id, i) => {
      const t = find(d, id)
      if (t && t.order !== i) {
        t.order = i
        touch(t)
      }
    })
  })
}

export function deleteTask(id: string, scope: 'one' | 'future' = 'one'): void {
  mutate((d) => {
    const t = find(d, id)
    if (!t) return
    const s = liveSeries(d, t)
    if (s && t.occurrence) {
      if (scope === 'one') {
        s.skipDates.push(t.occurrence)
      } else {
        const from = t.occurrence
        s.endDate = from
        d.tasks = d.tasks.filter((x) => !(x.seriesId === s.id && (x.occurrence ?? x.date) >= from))
        if (from <= s.startDate) d.series = d.series.filter((x) => x.id !== s.id)
      }
      touch(s)
    }
    d.tasks = d.tasks.filter((x) => x.id !== id)
  })
}

// ---------- subtasks ----------

function editSubtasks(taskId: string, fn: (subs: Subtask[], t: Task) => void, templateChanged: boolean): void {
  mutate((d) => {
    const t = find(d, taskId)
    if (!t) return
    fn(t.subtasks, t)
    touch(t)
    if (templateChanged) syncTemplate(d, t, {}, t.subtasks.map((x) => x.title))
  })
}

export function addSubtask(taskId: string, title: string): void {
  editSubtasks(
    taskId,
    (subs, t) => {
      subs.push({ id: uid(), title, done: false })
      if (t.done) setDone(t, false)
    },
    true
  )
}

export function renameSubtask(taskId: string, subId: string, title: string): void {
  editSubtasks(
    taskId,
    (subs) => {
      const s = subs.find((x) => x.id === subId)
      if (s) s.title = title
    },
    true
  )
}

export function removeSubtask(taskId: string, subId: string): void {
  editSubtasks(
    taskId,
    (subs, t) => {
      t.subtasks = subs.filter((x) => x.id !== subId)
      if (t.subtasks.length && t.subtasks.every((x) => x.done) && !t.done) setDone(t, true)
    },
    true
  )
}

/** Ticking the last subtask completes the task; unticking one reopens it. */
export function toggleSubtask(taskId: string, subId: string): void {
  editSubtasks(
    taskId,
    (subs, t) => {
      const s = subs.find((x) => x.id === subId)
      if (!s) return
      s.done = !s.done
      const all = subs.every((x) => x.done)
      if (all && !t.done) setDone(t, true)
      if (!s.done && t.done) setDone(t, false)
    },
    false
  )
}

export function reorderSubtasks(taskId: string, orderedIds: string[]): void {
  editSubtasks(
    taskId,
    (subs, t) => {
      t.subtasks = orderedIds.map((id) => subs.find((x) => x.id === id)).filter((x): x is Subtask => !!x)
    },
    true
  )
}

// ---------- daily housekeeping ----------

/** Unfinished one-off tasks from earlier days move to today, on top, keeping their order. */
export function rollover(today: string): void {
  const stale = (t: Task): boolean => !t.done && !t.seriesId && t.date < today
  if (!getData().tasks.some(stale)) return
  mutate((d) => {
    const moving = d.tasks.filter(stale).sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order)
    const top = dayTasks(d, today).reduce((min, t) => Math.min(min, t.order), 0)
    moving.forEach((t, i) => {
      t.rolledFrom = t.rolledFrom ?? t.date
      t.date = today
      t.order = top - moving.length + i
      touch(t)
    })
  })
}

const WORK_CHECK_AT = 16 * 60

/**
 * Weekdays from 16:00: returns today's unfinished work tasks once per day, so
 * the user can tick off what they finished but forgot to mark.
 */
export function takeWorkCheck(): Task[] {
  const today = todayKey()
  const d0 = getData()
  const day = weekday(today)
  if (day === 0 || day === 6 || minutesOf(nowTime()) < WORK_CHECK_AT) return []
  if (d0.settings.workCheckDate === today) return []
  const open = d0.tasks
    .filter((t) => t.date === today && t.category === 'work' && !t.done)
    .sort((a, b) => a.order - b.order)
  if (!open.length) return []
  mutate((d) => {
    d.settings.workCheckDate = today
  })
  return open
}

/** Returns reminders due now and marks them shown. Reminders missed by more than 15 min are skipped. */
export function takeDueReminders(): Task[] {
  const today = todayKey()
  const now = minutesOf(nowTime())
  const due = getData().tasks.filter(
    (t) =>
      t.date === today &&
      t.reminder &&
      !t.done &&
      t.remindedKey !== `${today} ${t.reminder}` &&
      minutesOf(t.reminder) <= now
  )
  if (!due.length) return []
  mutate((d) => {
    for (const x of due) {
      const t = find(d, x.id)
      if (t) t.remindedKey = `${today} ${t.reminder}`
    }
  })
  return due.filter((t) => now - minutesOf(t.reminder!) <= 15)
}

// ---------- hourly check-ins ----------

/** Minutes into the hour during which the prompt may still appear (so opening the app at 10:40 waits for 11:00). */
const CHECK_IN_WINDOW = 10

/** Once per hour, in the first minutes of the hour: returns the slot to ask "What are you doing?" about. */
export function takeHourlyCheckIn(): { date: string; time: string } | null {
  const date = todayKey()
  const now = nowTime()
  const hour = now.slice(0, 2)
  const key = `${date} ${hour}`
  if (getData().settings.checkInHour === key) return null
  mutate((d) => {
    d.settings.checkInHour = key
  })
  return minutesOf(now) % 60 < CHECK_IN_WINDOW ? { date, time: `${hour}:00` } : null
}

/** Record an answer. Empty text keeps the slot in the notes as skipped. */
export function addCheckIn(date: string, time: string, text: string): void {
  mutate((d) => {
    const now = stamp()
    d.checkIns.push({ id: uid(), date, time, text: text.trim(), createdAt: now, updatedAt: now })
  })
}

export function updateCheckIn(id: string, text: string): void {
  mutate((d) => {
    const c = d.checkIns.find((x) => x.id === id)
    if (!c) return
    c.text = text
    touch(c)
  })
}

export function deleteCheckIn(id: string): void {
  mutate((d) => {
    d.checkIns = d.checkIns.filter((x) => x.id !== id)
  })
}

// ---------- counters ----------

/** Unnamed daily counters shown in Free time, e.g. 0 / 100. */
export const COUNTER_TARGETS = [100, 50, 20]

export function tallyFor(d: AppData, date: string): number[] {
  const values = d.tallies.find((t) => t.date === date)?.values ?? []
  return COUNTER_TARGETS.map((_, i) => values[i] ?? 0)
}

/** Add to one counter for a day (negative amounts subtract). Never goes below 0. */
export function addToCounter(date: string, index: number, amount: number): void {
  mutate((d) => {
    let tally = d.tallies.find((t) => t.date === date)
    if (!tally) {
      tally = { id: uid(), date, values: [], updatedAt: stamp() }
      d.tallies.push(tally)
    }
    const values = tallyFor(d, date)
    values[index] = Math.max(0, values[index] + amount)
    tally.values = values
    touch(tally)
  })
}

// ---------- settings ----------

export function toggleTheme(): void {
  mutate((d) => {
    d.settings.theme = d.settings.theme === 'dark' ? 'light' : 'dark'
  })
}

export function setCategoryCollapsed(category: Category, collapsed: boolean): void {
  mutate((d) => {
    d.settings.collapsed[category] = collapsed
  })
}

export function setAddCategory(category: Category): void {
  mutate((d) => {
    d.settings.addCategory = category
  })
}

export function setDoneCollapsed(collapsed: boolean): void {
  mutate((d) => {
    d.settings.doneCollapsed = collapsed
  })
}
