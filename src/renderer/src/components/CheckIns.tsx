import { Plus, X } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { addCheckIn, deleteCheckIn, updateCheckIn } from '../lib/actions'
import { formatDay, nowTime, relativeLabel, todayKey } from '../lib/dates'
import { useData } from '../lib/store'
import type { CheckIn } from '../lib/types'
import { IconButton } from './bits'

export interface CheckInSlot {
  date: string
  time: string
}

/**
 * Hourly "What are you doing?" prompt. Writing is optional: Skip (or Enter on an
 * empty field, or Escape) still logs the hour, with nothing after "Doing:".
 */
export function CheckInPrompt({ slot, onClose }: { slot: CheckInSlot; onClose: () => void }): ReactNode {
  const data = useData()
  const [text, setText] = useState('')
  const doing = data.tasks.filter((t) => t.date === slot.date && t.doing && !t.done)

  const finish = (answer: string): void => {
    addCheckIn(slot.date, slot.time, answer)
    onClose()
  }

  return (
    <div
      className="overlay"
      onMouseDown={(e) => e.target === e.currentTarget && finish('')}
      onKeyDown={(e) => e.key === 'Escape' && finish('')}
    >
      <form
        className="dialog"
        role="dialog"
        aria-modal="true"
        onSubmit={(e) => {
          e.preventDefault()
          finish(text)
        }}
      >
        <h2>What are you doing?</h2>
        <p>{slot.time} check-in. Leave it empty to skip.</p>
        <input
          autoFocus
          className="field-input wide"
          value={text}
          placeholder="Doing…"
          onChange={(e) => setText(e.target.value)}
        />
        {doing.length > 0 && (
          <div className="doing-picks">
            {doing.map((t) => (
              <button key={t.id} type="button" className="doing-pick" onClick={() => setText(t.title)}>
                {t.title || 'Untitled'}
              </button>
            ))}
          </div>
        )}
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={() => finish('')}>
            Skip
          </button>
          <button type="submit" className="btn primary">
            Save
          </button>
        </div>
      </form>
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
