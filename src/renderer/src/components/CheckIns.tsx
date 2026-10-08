import { ArrowLeft, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { addNote, answerCheckIn, deleteCheckIn, deleteNote, running, runningMs, updateCheckIn, updateNote } from '../lib/actions'
import { formatDay, formatShort, nowTime, relativeLabel, todayKey } from '../lib/dates'
import { ask } from '../lib/ui'
import { getData, useData } from '../lib/store'
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

type NotesTab = 'pad' | 'log'

/** Notes view: a notepad of free-form notes, and the log of hourly check-ins. */
export function NotesPanel({ today, onAdd }: { today: string; onAdd: (slot: CheckInSlot) => void }): ReactNode {
  const [tab, setTab] = useState<NotesTab>('pad')
  const [openId, setOpenId] = useState<string | null>(null)

  return (
    <div className="notes-view">
      <div className="notes-head">
        <div className="seg" role="tablist" aria-label="Notes">
          {(['pad', 'log'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              className={cls('seg-btn', tab === t && 'on')}
              onClick={() => setTab(t)}
            >
              {t === 'pad' ? 'Notepad' : 'Check-ins'}
            </button>
          ))}
        </div>
        {tab === 'pad' ? (
          <button type="button" className="btn ghost" onClick={() => setOpenId(addNote())}>
            <Plus /> New note
          </button>
        ) : (
          <button type="button" className="btn ghost" onClick={() => onAdd({ date: todayKey(), time: nowTime() })}>
            <Plus /> Add entry
          </button>
        )}
      </div>
      {tab === 'pad' ? <Notepad openId={openId} onOpen={setOpenId} /> : <CheckInLog today={today} />}
    </div>
  )
}

const noteTitle = (text: string): string => text.trim().split('\n')[0].trim()

function Notepad({ openId, onOpen }: { openId: string | null; onOpen: (id: string | null) => void }): ReactNode {
  const data = useData()
  const note = openId ? data.notes.find((n) => n.id === openId) : undefined

  // Leaving a note that was never written in (or switching views) removes it.
  useEffect(() => {
    if (!openId) return
    return () => {
      const n = getData().notes.find((x) => x.id === openId)
      if (n && !n.text.trim()) deleteNote(n.id)
    }
  }, [openId])
  const close = (): void => onOpen(null)

  const remove = async (): Promise<void> => {
    if (!note) return
    if (note.text.trim()) {
      const r = await ask({
        title: 'Delete note?',
        message: `"${noteTitle(note.text)}" will be removed.`,
        buttons: [
          { id: 'cancel', label: 'Cancel' },
          { id: 'delete', label: 'Delete', kind: 'danger' }
        ]
      })
      if (r.button !== 'delete') return
    }
    deleteNote(note.id)
    onOpen(null)
  }

  if (note) {
    return (
      <div className="note-editor">
        <div className="note-bar">
          <IconButton title="All notes" onClick={close}>
            <ArrowLeft />
          </IconButton>
          <span className="note-stamp">Edited {formatEdited(note.updatedAt)}</span>
          <IconButton title="Delete note" onClick={remove}>
            <Trash2 />
          </IconButton>
        </div>
        <textarea
          autoFocus
          className="note-area"
          value={note.text}
          placeholder="Write something. The first line is the title."
          onChange={(e) => updateNote(note.id, e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && close()}
        />
      </div>
    )
  }

  const notes = [...data.notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return (
    <div className="list">
      {notes.map((n) => {
        const [, ...rest] = n.text.trim().split('\n')
        const preview = rest.join(' ').trim()
        return (
          <button key={n.id} type="button" className="note-card" onClick={() => onOpen(n.id)}>
            <span className="note-card-title">{noteTitle(n.text) || 'Empty note'}</span>
            {preview && <span className="note-card-preview">{preview}</span>}
            <span className="note-card-date">{formatEdited(n.updatedAt)}</span>
          </button>
        )
      })}
      {notes.length === 0 && <p className="empty">No notes yet. Click "New note" to start one.</p>}
    </div>
  )
}

/** "14:05" today, "07 Oct" earlier. */
function formatEdited(iso: string): string {
  const d = new Date(iso)
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return key === todayKey() ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : formatShort(key)
}

/** Every hourly check-in, newest day first, as "time  Doing: …". */
function CheckInLog({ today }: { today: string }): ReactNode {
  const data = useData()

  const days = useMemo(() => {
    const byDate = new Map<string, CheckIn[]>()
    const sorted = [...data.checkIns].sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time))
    for (const c of sorted) byDate.set(c.date, [...(byDate.get(c.date) ?? []), c])
    return [...byDate.entries()]
  }, [data.checkIns])

  return (
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
      {days.length === 0 && <p className="empty">Every hour you'll be asked what you're doing. Answers show up here.</p>}
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
