import { Clock, Pause, Play, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { dismissAway, keepAwayTime, pauseTimer, running, runningMs, startTimer, trackedMs } from '../lib/actions'
import { useData } from '../lib/store'
import type { AppData, AwayReason, Session, Task } from '../lib/types'
import { cls } from './bits'

/** Current time in ms, refreshed every `everyMs` while `active`. */
export function useNow(active: boolean, everyMs = 1000): number {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), everyMs)
    return () => window.clearInterval(timer)
  }, [active, everyMs])
  return now
}

const pad = (n: number): string => String(n).padStart(2, '0')

/** "42m", "1h 05m"; with `clock`, "4:09" or "1:02:09". */
export function formatDuration(ms: number, clock = false): string {
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  if (clock) return h ? `${h}:${pad(m)}:${pad(total % 60)}` : `${m}:${pad(total % 60)}`
  if (!h) return m ? `${m}m` : '<1m'
  return `${h}h ${pad(m)}m`
}

const hhmm = (iso: string): string => {
  const d = new Date(iso)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** What a session is about: the task's current title, or "Other: note". */
export function sessionLabel(d: AppData, s: Session): string {
  if (!s.taskId) return s.note ? `Other: ${s.note}` : 'Other'
  return d.tasks.find((t) => t.id === s.taskId)?.title || s.title || 'Untitled'
}

/** Play / pause next to a task's checkbox. Starting one task pauses whichever was running. */
export function TimerButton({ task }: { task: Task }): ReactNode {
  if (task.done) return null
  const on = task.doing
  return (
    <button
      type="button"
      className={cls('timer-btn', on && 'on', task.paused && 'paused')}
      title={on ? 'Pause timer' : task.paused ? 'Resume timer' : 'Start timer (sets Doing)'}
      onClick={(e) => {
        e.stopPropagation()
        if (on) pauseTimer()
        else startTimer(task.id)
      }}
    >
      {on ? <Pause /> : <Play />}
    </button>
  )
}

/** Tracked time shown in a task's meta row; ticks while its timer runs. */
export function TaskTime({ task }: { task: Task }): ReactNode {
  const data = useData()
  const now = useNow(task.doing, 30_000)
  const ms = trackedMs(data, task.id, now)
  if (!ms && !task.doing) return null
  return (
    <span className={cls('meta-item', 'tracked', task.doing && 'live')} title="Time tracked">
      <Clock />
      {formatDuration(ms)}
    </span>
  )
}

/** Strip under the title bar while a timer runs. */
export function RunningBar({ onOpen }: { onOpen: (taskId: string) => void }): ReactNode {
  const data = useData()
  const s = running(data)
  const now = useNow(!!s)
  if (!s) return null
  return (
    <div className="running-bar">
      <span className="running-dot" />
      <button
        type="button"
        className="running-title"
        disabled={!s.taskId}
        title={s.taskId ? 'Show task' : undefined}
        onClick={() => s.taskId && onOpen(s.taskId)}
      >
        {sessionLabel(data, s)}
      </button>
      <span className="running-time">{formatDuration(runningMs(s, now), true)}</span>
      <button type="button" className="icon-btn small" title="Pause timer" onClick={pauseTimer}>
        <Pause />
      </button>
    </div>
  )
}

const AWAY_TEXT: Record<AwayReason, string> = {
  lock: 'screen locked',
  sleep: 'PC asleep or Todo not running',
  closed: 'Todo closed',
  prompt: 'no answer to the check-in'
}

/** After an automatic pause: offer to count the away time after all. */
export function AwayToast(): ReactNode {
  const data = useData()
  const away = data.settings.awayPause
  const s = away && data.sessions.find((x) => x.id === away.sessionId)
  if (!away || !s || running(data)) return null
  return (
    <div className="toast" role="status">
      <span className="toast-text">
        Paused <strong>{sessionLabel(data, s)}</strong> at {hhmm(away.at)} ({AWAY_TEXT[away.reason]}).
      </span>
      <button type="button" className="btn ghost" title="Count the time away and keep the timer running" onClick={keepAwayTime}>
        Keep time
      </button>
      <button type="button" className="icon-btn small" title="Leave it paused" onClick={dismissAway}>
        <X />
      </button>
    </div>
  )
}
