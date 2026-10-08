import { addDays, minutesOf, nowTime, todayKey, weekday } from './dates'
import { PROJECT_COLORS } from './colors'
import { getData, mutate, stamp, uid } from './store'
import type { AppData, AwayReason, Category, Priority, Project, Repeat, Series, Session, Status, Subtask, Task } from './types'

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
    paused: false,
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

/** Finishing or reopening a task also ends "doing"; reopened tasks go back to To do. Call `settle` after. */
function setDone(t: Task, done: boolean): void {
  t.done = done
  t.doneAt = done ? stamp() : null
  t.doing = false
  t.paused = false
  touch(t)
}

export const taskStatus = (t: Task): Status => (t.done ? 'done' : t.doing ? 'doing' : t.paused ? 'paused' : 'todo')

export const STATUS_LABEL: Record<Status, string> = { todo: 'To do', doing: 'Doing', paused: 'Paused', done: 'Done' }
export const STATUSES: Status[] = ['todo', 'doing', 'paused', 'done']

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
    settle(d)
  })
}

export function setStatus(id: string, status: Status): void {
  mutate((d) => {
    const t = find(d, id)
    if (!t || taskStatus(t) === status) return
    if (status === 'doing') return startIn(d, t)
    if (status === 'done') setDone(t, true)
    else {
      if (t.done) setDone(t, false)
      if (running(d)?.taskId === t.id) stopRunning(d, stamp())
      t.doing = false
      t.paused = status === 'paused'
      touch(t)
    }
    settle(d)
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
    settle(d)
  })
}

// ---------- subtasks ----------

function editSubtasks(taskId: string, fn: (subs: Subtask[], t: Task) => void, templateChanged: boolean): void {
  mutate((d) => {
    const t = find(d, taskId)
    if (!t) return
    fn(t.subtasks, t)
    touch(t)
    settle(d)
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

/** Weekdays 08:00 to 20:00 the prompt always asks; other hours only while a timer runs. */
function promptHour(date: string, hour: number): boolean {
  const day = weekday(date)
  return (day !== 0 && day !== 6 && hour >= 8 && hour <= 20) || !!running(getData())
}

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
  if (!promptHour(date, Number(hour))) return null
  return minutesOf(now) % 60 < CHECK_IN_WINDOW ? { date, time: `${hour}:00` } : null
}

/** Record a check-in. Empty text with no task keeps the slot in the notes as skipped. */
export function addCheckIn(date: string, time: string, text: string, taskId: string | null = null): void {
  mutate((d) => {
    const now = stamp()
    d.checkIns.push({ id: uid(), date, time, text: text.trim(), taskId, createdAt: now, updatedAt: now })
  })
}

/**
 * Answer the prompt. The answer sets what the timer runs from now on: the
 * running task keeps going, another task takes over, "Other" runs an Other
 * timer holding the note. Past time is never rewritten.
 */
export function answerCheckIn(date: string, time: string, answer: { taskId: string } | { note: string }): void {
  mutate((d) => {
    const now = stamp()
    const current = running(d)
    if ('taskId' in answer) {
      const t = find(d, answer.taskId)
      if (!t) return
      d.checkIns.push({ id: uid(), date, time, text: t.title, taskId: t.id, createdAt: now, updatedAt: now })
      if (current?.taskId !== t.id) startIn(d, t)
    } else {
      const note = answer.note.trim()
      d.checkIns.push({ id: uid(), date, time, text: note || 'Other', taskId: null, createdAt: now, updatedAt: now })
      const sameOther = current && current.taskId === null && (!note || current.note === note)
      if (!sameOther) startOtherIn(d, note)
    }
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

// ---------- notepad ----------

export function addNote(): string {
  const id = uid()
  mutate((d) => {
    const now = stamp()
    d.notes.push({ id, text: '', createdAt: now, updatedAt: now })
  })
  return id
}

export function updateNote(id: string, text: string): void {
  mutate((d) => {
    const n = d.notes.find((x) => x.id === id)
    if (!n) return
    n.text = text
    touch(n)
  })
}

export function deleteNote(id: string): void {
  mutate((d) => {
    d.notes = d.notes.filter((x) => x.id !== id)
  })
}

// ---------- timer ----------

/** Minutes without a heartbeat after which a running timer is treated as stopped (sleep, crash). */
const BEAT_GAP_MIN = 3

export const running = (d: AppData): Session | undefined => d.sessions.find((s) => s.end === null)

/** Close the running session at `at`. Its task becomes Paused. */
function stopRunning(d: AppData, at: string): Session | undefined {
  const s = running(d)
  if (!s) return undefined
  s.end = at < s.start ? s.start : at
  touch(s)
  const t = s.taskId ? find(d, s.taskId) : undefined
  if (t && t.doing) {
    t.doing = false
    t.paused = !t.done
    touch(t)
  }
  return s
}

function openSession(d: AppData, t: Task | null, note: string): void {
  const now = stamp()
  d.sessions.push({
    id: uid(),
    taskId: t?.id ?? null,
    title: t?.title ?? '',
    projectId: t?.projectId ?? null,
    category: t?.category ?? 'work',
    note,
    start: now,
    end: null,
    beat: now,
    updatedAt: now
  })
  d.settings.awayPause = null
}

function startIn(d: AppData, t: Task): void {
  stopRunning(d, stamp())
  if (t.done) setDone(t, false)
  t.doing = true
  t.paused = false
  touch(t)
  openSession(d, t, '')
}

function startOtherIn(d: AppData, note: string): void {
  stopRunning(d, stamp())
  openSession(d, null, note)
}

/** A running timer whose task was finished or deleted stops; time already tracked stays. */
function settle(d: AppData): void {
  const s = running(d)
  if (!s?.taskId) return
  const t = find(d, s.taskId)
  if (!t || t.done) {
    s.end = stamp()
    touch(s)
  }
}

export function startTimer(taskId: string): void {
  mutate((d) => {
    const t = find(d, taskId)
    if (t) startIn(d, t)
  })
}

export function pauseTimer(): void {
  if (!running(getData())) return
  mutate((d) => {
    stopRunning(d, stamp())
    d.settings.awayPause = null
  })
}

/** The app pauses the timer itself (screen locked, sleep, closed, prompt not answered). */
export function autoPause(reason: AwayReason, at: string = stamp()): void {
  if (!running(getData())) return
  mutate((d) => {
    const s = stopRunning(d, at)
    if (s) d.settings.awayPause = { sessionId: s.id, at: s.end!, reason }
  })
}

/** "Keep time": resume the auto-paused session as if it had never stopped. */
export function keepAwayTime(): void {
  mutate((d) => {
    const away = d.settings.awayPause
    d.settings.awayPause = null
    const s = away && d.sessions.find((x) => x.id === away.sessionId)
    if (!s || running(d)) return
    const t = s.taskId ? find(d, s.taskId) : undefined
    if (s.taskId && (!t || t.done)) return
    s.end = null
    s.beat = stamp()
    touch(s)
    if (t) {
      t.doing = true
      t.paused = false
      touch(t)
    }
  })
}

export function dismissAway(): void {
  mutate((d) => {
    d.settings.awayPause = null
  })
}

/**
 * Called about once a minute. A running timer that has not been seen for a few
 * minutes (the PC slept, or the app crashed) is stopped at the last time it was seen.
 */
export function timerHeartbeat(): void {
  const s = running(getData())
  if (!s) return
  const now = Date.now()
  const last = Date.parse(s.beat)
  if (now - last > BEAT_GAP_MIN * 60_000) {
    autoPause('sleep', s.beat)
    return
  }
  if (now - last < 50_000) return
  mutate((d) => {
    const r = running(d)
    if (r) r.beat = new Date(now).toISOString()
  })
}

const sessionMs = (s: Session, now: number): number => Math.max(0, (s.end ? Date.parse(s.end) : now) - Date.parse(s.start))

/** Total tracked time for a task over every day. */
export function trackedMs(d: AppData, taskId: string, now: number): number {
  return d.sessions.reduce((sum, s) => (s.taskId === taskId ? sum + sessionMs(s, now) : sum), 0)
}

export const runningMs = (s: Session, now: number): number => sessionMs(s, now)

// ---------- counters ----------

export function counterValue(d: AppData, date: string, counterId: string): number {
  return d.tallies.find((t) => t.date === date)?.values[counterId] ?? 0
}

/** Set a counter's value for a day. Never goes below 0. The day keeps the goal it had when first counted. */
export function setCounterValue(date: string, counterId: string, value: number): void {
  mutate((d) => {
    let tally = d.tallies.find((t) => t.date === date)
    if (!tally) {
      tally = { id: uid(), date, values: {}, targets: {}, updatedAt: stamp() }
      d.tallies.push(tally)
    }
    tally.values[counterId] = Math.max(0, value)
    const counter = d.counters.find((c) => c.id === counterId)
    if (counter && !(counterId in tally.targets)) tally.targets[counterId] = counter.target
    touch(tally)
  })
}

/** Add to a counter for a day (negative amounts subtract). */
export function addToCounter(date: string, counterId: string, amount: number): void {
  setCounterValue(date, counterId, counterValue(getData(), date, counterId) + amount)
}

/** New goal from today on; earlier days keep theirs. */
export function setCounterTarget(counterId: string, target: number): void {
  mutate((d) => {
    const c = d.counters.find((x) => x.id === counterId)
    if (!c) return
    c.target = Math.max(1, target)
    touch(c)
    const today = d.tallies.find((t) => t.date === todayKey())
    if (today && counterId in today.values) {
      today.targets[counterId] = c.target
      touch(today)
    }
  })
}

export function renameCounter(counterId: string, name: string): void {
  mutate((d) => {
    const c = d.counters.find((x) => x.id === counterId)
    if (!c) return
    c.name = name
    touch(c)
  })
}

export function addCounter(target = 100): string {
  const id = uid()
  mutate((d) => {
    // "Counter N" with the next number not already taken.
    const used = new Set(d.counters.map((c) => c.name))
    let n = d.counters.length + 1
    while (used.has(`Counter ${n}`)) n++
    d.counters.push({ id, name: `Counter ${n}`, target, updatedAt: stamp() })
  })
  return id
}

/** Removes the box and its numbers on every day. */
export function removeCounter(counterId: string): void {
  mutate((d) => {
    d.counters = d.counters.filter((c) => c.id !== counterId)
    for (const t of d.tallies) {
      if (!(counterId in t.values)) continue
      delete t.values[counterId]
      delete t.targets[counterId]
      touch(t)
    }
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
