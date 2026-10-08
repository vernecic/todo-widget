import { addDays, fromKey, toKey, weekday } from './dates'
import type { AppData, Counter, Tally } from './types'

// ---------- tasks done per day ----------

/** Tasks counted on the day they were ticked done (not the day they were planned). */
export function doneByDay(d: AppData): Map<string, number> {
  const counts = new Map<string, number>()
  for (const t of d.tasks) {
    if (!t.done || !t.doneAt) continue
    const key = toKey(new Date(t.doneAt))
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

/** Monday on or before `date`. */
export function mondayOf(date: string): string {
  return addDays(date, -((weekday(date) + 6) % 7))
}

/** Columns of 7 days (Mon to Sun), the last one holding `today`. */
export function gridWeeks(today: string, weeks: number): string[][] {
  const start = addDays(mondayOf(today), -7 * (weeks - 1))
  return Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, i) => addDays(start, w * 7 + i)))
}

/** Shade 0 to 4, scaled to the user's own days: quartiles of the days that had anything done. */
export function levelScale(counts: number[]): (n: number) => number {
  const sorted = counts.filter((n) => n > 0).sort((a, b) => a - b)
  const q = (p: number): number => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 1
  const [q1, q2, q3] = [q(0.25), q(0.5), q(0.75)]
  return (n) => (n <= 0 ? 0 : n <= q1 ? 1 : n <= q2 ? 2 : n <= q3 ? 3 : 4)
}

/**
 * Longest run of consecutive days passing `hit` between `from` and `today`, and
 * the run that is still going. Today not being hit yet does not end the current run.
 */
export function streaks(from: string, today: string, hit: (date: string) => boolean): { longest: number; current: number } {
  let longest = 0
  let run = 0
  for (let day = from; day <= today; day = addDays(day, 1)) {
    run = hit(day) ? run + 1 : 0
    longest = Math.max(longest, run)
  }
  let current = 0
  let day = hit(today) ? today : addDays(today, -1)
  while (day >= from && hit(day)) {
    current++
    day = addDays(day, -1)
  }
  return { longest, current }
}

// ---------- counters ----------

/** The goal a counter had on a given day: saved with that day's count, else the current goal. */
export function goalOn(tally: Tally | undefined, counter: Counter): number {
  return tally?.targets?.[counter.id] ?? counter.target
}

export function counterStreaks(d: AppData, counter: Counter, today: string): { longest: number; current: number } {
  const byDate = new Map(d.tallies.map((t) => [t.date, t]))
  const dates = d.tallies.filter((t) => counter.id in t.values).map((t) => t.date)
  if (!dates.length) return { longest: 0, current: 0 }
  const first = dates.reduce((a, b) => (a < b ? a : b))
  return streaks(first, today, (date) => {
    const t = byDate.get(date)
    return !!t && (t.values[counter.id] ?? 0) >= goalOn(t, counter)
  })
}

// ---------- time ----------

export type TimeRange = 'today' | 'week' | 'month' | 'all'

export const RANGE_LABEL: Record<TimeRange, string> = {
  today: 'Today',
  week: 'This week',
  month: 'This month',
  all: 'All time'
}

function rangeStart(range: TimeRange, today: string): number {
  if (range === 'all') return -Infinity
  if (range === 'today') return fromKey(today).getTime()
  if (range === 'week') return fromKey(mondayOf(today)).getTime()
  return fromKey(`${today.slice(0, 7)}-01`).getTime()
}

export const FREE_SLICE = 'free'
export const OTHER_SLICE = 'other'

export interface Slice {
  /** Project id, or FREE_SLICE / OTHER_SLICE. */
  key: string
  label: string
  ms: number
  /** What the time went to, biggest first: task titles, Other notes, folded projects. */
  items: { label: string; ms: number }[]
}

/** Most project slices shown before the rest fold into Work Other (keeps the donut at 6 slices or fewer). */
const MAX_PROJECT_SLICES = 4

/**
 * Tracked time in the range, as slices: one per project, "Work Other" for work
 * with no project plus "Other" timers, and one Free time slice. Sessions are
 * clipped to the range, so a timer across midnight counts on both days.
 */
export function timeSlices(d: AppData, range: TimeRange, today: string, now: number, includeFree: boolean): Slice[] {
  const from = rangeStart(range, today)
  const buckets = new Map<string, Map<string, number>>()
  const add = (key: string, label: string, ms: number): void => {
    const items = buckets.get(key) ?? new Map<string, number>()
    items.set(label, (items.get(label) ?? 0) + ms)
    buckets.set(key, items)
  }

  for (const s of d.sessions) {
    const start = Math.max(Date.parse(s.start), from)
    const end = Math.min(s.end ? Date.parse(s.end) : now, now)
    if (end <= start) continue
    const ms = end - start
    if (!s.taskId) {
      add(OTHER_SLICE, s.note ? `Other: ${s.note}` : 'Other', ms)
      continue
    }
    // Follow the task as it is now (project or list may have changed); fall back to the copy for deleted tasks.
    const t = d.tasks.find((x) => x.id === s.taskId)
    const title = t?.title || s.title || 'Untitled'
    const category = t ? t.category : s.category
    const projectId = t ? t.projectId : s.projectId
    if (category === 'free') add(FREE_SLICE, title, ms)
    else if (projectId && d.projects.some((p) => p.id === projectId)) add(projectId, title, ms)
    else add(OTHER_SLICE, title, ms)
  }

  const total = (items: Map<string, number>): number => [...items.values()].reduce((a, b) => a + b, 0)
  const toSlice = (key: string, label: string, items: Map<string, number>): Slice => ({
    key,
    label,
    ms: total(items),
    items: [...items.entries()].map(([l, ms]) => ({ label: l, ms })).sort((a, b) => b.ms - a.ms)
  })

  const projects = d.projects
    .filter((p) => buckets.has(p.id))
    .map((p) => toSlice(p.id, p.name || 'Untitled', buckets.get(p.id)!))
    .sort((a, b) => b.ms - a.ms)

  // Small projects past the limit join Work Other, listed by name.
  const other = buckets.get(OTHER_SLICE) ?? new Map<string, number>()
  for (const p of projects.slice(MAX_PROJECT_SLICES)) other.set(`Project ${p.label}`, p.ms)

  const slices = projects.slice(0, MAX_PROJECT_SLICES)
  if (other.size) slices.push(toSlice(OTHER_SLICE, 'Work Other', other))
  if (includeFree && buckets.has(FREE_SLICE)) slices.push(toSlice(FREE_SLICE, 'Free time', buckets.get(FREE_SLICE)!))
  return slices.filter((s) => s.ms > 0)
}
