import { Plus, X } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { answerCheckIn, deleteCheckIn, running, runningMs, updateCheckIn } from '../lib/actions'
import { formatDay, nowTime, relativeLabel, todayKey } from '../lib/dates'
import { useData } from '../lib/store'
import type { CheckIn, Task } from '../lib/types'
import { cls, IconButton, ProjectPill } from './bits'
import { formatDuration, sessionLabel, useNow } from './Timer'

export interface CheckInSlot {
  date: string
  time: string
}

/**
 * Hourly "What are you doing?" prompt. An answer is required: one of the day's
 * open tasks, or "Other" with an optional note. The answer drives the timer
 * from now on. Left unanswered for 5 minutes, the timer pauses (see App).
 */
export function CheckInPrompt({ slot, onClose }: { slot: CheckInSlot; onClose: () => void }): ReactNode {
  const data = useData()
  const [other, setOther] = useState(false)
  const [note, setNote] = useState('')
  const current = running(data)
  const now = useNow(!!current)
  const rank = (t: Task): number => (t.doing ? 0 : t.paused ? 1 : 2)
  const tasks = data.tasks
    .filter((t) => t.date === slot.date && !t.done)
    .sort((a, b) => rank(a) - rank(b) || a.order - b.order)

  const pick = (answer: { taskId: string } | { note: string }): void => {
    answerCheckIn(slot.date, slot.time, answer)
    onClose()
  }

  return (
    <div className="overlay">
      <div className="dialog checkin" role="dialog" aria-modal="true">
        <h2>What are you doing?</h2>
        <p>
          {slot.time} check-in ·{' '}
          {current ? (
            <>
              Running: <strong>{sessionLabel(data, current)}</strong> · {formatDuration(runningMs(current, now))}
            </>
          ) : (
            'No timer running'
          )}
        </p>
        <div className="pick-list">
          {tasks.map((t) => {
            const project = data.projects.find((p) => p.id === t.projectId)
            return (
              <button key={t.id} type="button" className={cls('pick', t.doing && 'on')} onClick={() => pick({ taskId: t.id })}>
                <span className="pick-title">{t.title || 'Untitled'}</span>
                {project && <ProjectPill project={project} />}
                {(t.doing || t.paused) && <span className={cls('pick-status', t.doing && 'on')}>{t.doing ? 'Running' : 'Paused'}</span>}
              </button>
            )
          })}
          {tasks.length === 0 && <p className="empty small">No open tasks today.</p>}
          <button type="button" className={cls('pick', 'other', other && 'open')} onClick={() => setOther(true)}>
            <span className="pick-title">Other…</span>
          </button>
        </div>
        {other && (
          <form
            className="other-form"
            onSubmit={(e) => {
              e.preventDefault()
              pick({ note })
            }}
          >
            <input
              autoFocus
              className="field-input wide"
              value={note}
              placeholder="What? (optional)"
              onChange={(e) => setNote(e.target.value)}
            />
            <button type="submit" className="btn primary">
              Save
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

/** Notes tab: every check-in, newest day first, as "time  Doing: …". */
export function NotesPanel({ today, onAdd }: { today: string; onAdd: (slot: CheckInSlot) => void }): ReactNode {
  const data = useData()

  const days = useMemo(() => {
    const byDate = new Map<string, CheckIn[]>()
    const sorted = [...data.checkIns].sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time))
    for (const c of sorted) byDate.set(c.date, [...(byDate.get(c.date) ?? []), c])
    return [...byDate.entries()]
  }, [data.checkIns])

  return (
    <div className="notes-view">
      <div className="notes-head">
        <h2>Notes</h2>
        <button type="button" className="btn ghost" onClick={() => onAdd({ date: todayKey(), time: nowTime() })}>
          <Plus /> Add entry
        </button>
      </div>
      <div className="list">
        {days.map(([date, entries]) => (
          <section key={date} className="result-group">
            <h3>
              {formatDay(date)}
              {relativeLabel(date, today) && <span> · {relativeLabel(date, today)}</span>}
            </h3>
            {entries.map((c) => (
              <NoteRow key={c.id} entry={c} />
            ))}
          </section>
        ))}
        {days.length === 0 && (
          <p className="empty">Every hour you'll be asked what you're doing. Answers show up here.</p>
        )}
      </div>
    </div>
  )
}

function NoteRow({ entry }: { entry: CheckIn }): ReactNode {
  return (
    <div className="note-row">
      <span className="note-time">{entry.time}</span>
      <span className="note-label">Doing:</span>
      <input
        className="note-text"
        value={entry.text}
        placeholder="skipped"
        onChange={(e) => updateCheckIn(entry.id, e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
      <IconButton className="small remove" title="Delete entry" onClick={() => deleteCheckIn(entry.id)}>
        <X />
      </IconButton>
    </div>
  )
}
