const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const pad = (n: number): string => String(n).padStart(2, '0')

export function toKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const todayKey = (): string => toKey(new Date())

export function addDays(key: string, n: number): string {
  const d = fromKey(key)
  d.setDate(d.getDate() + n)
  return toKey(d)
}

export const weekday = (key: string): number => fromKey(key).getDay()

/** "Tue 07 Oct" */
export function formatDay(key: string): string {
  const d = fromKey(key)
  return `${DAYS[d.getDay()]} ${pad(d.getDate())} ${MONTHS[d.getMonth()]}`
}

/** "07 Oct", with the year added when it differs from the current one. */
export function formatShort(key: string): string {
  const d = fromKey(key)
  const base = `${pad(d.getDate())} ${MONTHS[d.getMonth()]}`
  return d.getFullYear() === new Date().getFullYear() ? base : `${base} ${d.getFullYear()}`
}

export function relativeLabel(key: string, today: string): string | null {
  if (key === today) return 'Today'
  if (key === addDays(today, 1)) return 'Tomorrow'
  if (key === addDays(today, -1)) return 'Yesterday'
  return null
}

export function nowTime(): string {
  const d = new Date()
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function minutesOf(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/** Monday-first order for the weekday picker. */
export const WEEK = [1, 2, 3, 4, 5, 6, 0].map((d) => ({ day: d, label: DAYS[d].slice(0, 2) }))
