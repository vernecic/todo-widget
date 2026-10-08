import { useDroppable } from '@dnd-kit/core'
import { ChevronDown, Plus, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  addCounter,
  addToCounter,
  CATEGORY_LABEL,
  counterValue,
  removeCounter,
  renameCounter,
  setCategoryCollapsed,
  setCounterTarget,
  setCounterValue,
  toggleTask
} from '../lib/actions'
import { counterStreaks } from '../lib/stats'
import { useData } from '../lib/store'
import { todayKey } from '../lib/dates'
import type { Category, Counter, Task } from '../lib/types'
import { ask } from '../lib/ui'
import { Checkbox, cls } from './bits'

/** Collapsible WORK / FREE TIME list. The header is a drop target that moves a task to the top of this list. */
export function CategorySection(props: { category: Category; count: number; children: ReactNode }): ReactNode {
  const data = useData()
  const collapsed = data.settings.collapsed[props.category]
  const { setNodeRef, isOver } = useDroppable({ id: `section-${props.category}` })
  return (
    <section className={cls('cat-section', collapsed && 'collapsed')}>
      <button
        ref={setNodeRef}
        type="button"
        className={cls('cat-head', isOver && 'over')}
        onClick={() => setCategoryCollapsed(props.category, !collapsed)}
      >
        <ChevronDown />
        {CATEGORY_LABEL[props.category]}
        <span className="cat-count">{props.count}</span>
      </button>
      {!collapsed && props.children}
    </section>
  )
}

export function Counters({ date }: { date: string }): ReactNode {
  const data = useData()
  // A box that was just added opens with its target ready to type.
  const [fresh, setFresh] = useState<string | null>(null)
  useEffect(() => {
    if (fresh) setFresh(null)
  }, [fresh])
  return (
    <div className="counters">
      {data.counters.map((c) => (
        <CounterBox
          key={c.id}
          date={date}
          counter={c}
          value={counterValue(data, date, c.id)}
          streak={counterStreaks(data, c, todayKey()).current}
          editTarget={fresh === c.id}
        />
      ))}
      <button type="button" className="counter-add" title="Add a counter" onClick={() => setFresh(addCounter())}>
        <Plus />
      </button>
    </div>
  )
}

function CounterBox(props: { date: string; counter: Counter; value: number; streak: number; editTarget: boolean }): ReactNode {
  const [draft, setDraft] = useState('')
  const { date, counter, value } = props
  const target = counter.target

  const remove = async (): Promise<void> => {
    const r = await ask({
      title: 'Remove counter?',
      message: `"${counter.name}" and its numbers on every day are removed.`,
      buttons: [
        { id: 'cancel', label: 'Cancel' },
        { id: 'remove', label: 'Remove', kind: 'danger' }
      ]
    })
    if (r.button === 'remove') removeCounter(counter.id)
  }

  return (
    <form
      className={cls('counter', value >= target && 'complete')}
      onSubmit={(e) => {
        e.preventDefault()
        const n = Number.parseInt(draft, 10)
        if (Number.isFinite(n) && n !== 0) addToCounter(date, counter.id, n)
        setDraft('')
      }}
    >
      <button type="button" className="icon-btn small counter-remove" title="Remove counter" onClick={remove}>
        <X />
      </button>
      <div className="counter-name">
        <TextEdit value={counter.name} fallback="Counter" onCommit={(name) => renameCounter(counter.id, name)} />
      </div>
      <div className="counter-num">
        <NumberEdit
          className="counter-value"
          value={value}
          min={0}
          title="Click to change this day's number"
          onCommit={(n) => setCounterValue(date, counter.id, n)}
        />
        {' / '}
        <NumberEdit
          value={target}
          min={1}
          title="Click to change the goal"
          autoEdit={props.editTarget}
          onCommit={(n) => setCounterTarget(counter.id, n)}
        />
        {props.streak >= 2 && (
          <span className="counter-streak" title={`Goal reached ${props.streak} days in a row`}>
            🔥{props.streak}
          </span>
        )}
      </div>
      <div className="counter-bar">
        <span style={{ width: `${Math.min(100, (value / target) * 100)}%` }} />
      </div>
      <input
        inputMode="numeric"
        value={draft}
        placeholder="+ add"
        title="Type a number and press Enter to add it. Use -5 to take 5 away."
        onChange={(e) => setDraft(e.target.value.replace(/[^\d-]/g, ''))}
      />
    </form>
  )
}

/** Text that turns into an input when clicked. Enter or leaving saves, Escape cancels; empty keeps the old text. */
function TextEdit(props: { value: string; fallback: string; onCommit: (value: string) => void }): ReactNode {
  const [draft, setDraft] = useState<string | null>(null)
  const cancelled = useRef(false)

  if (draft === null) {
    return (
      <button
        type="button"
        className="text-edit"
        title="Click to rename"
        onClick={() => {
          cancelled.current = false
          setDraft(props.value)
        }}
      >
        {props.value || props.fallback}
      </button>
    )
  }

  const commit = (): void => {
    const clean = draft.trim()
    if (!cancelled.current && clean && clean !== props.value) props.onCommit(clean)
    setDraft(null)
  }

  return (
    <input
      autoFocus
      className="text-edit editing"
      value={draft}
      onFocus={(e) => e.target.select()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          e.currentTarget.blur()
        } else if (e.key === 'Escape') {
          e.stopPropagation()
          cancelled.current = true
          e.currentTarget.blur()
        }
      }}
    />
  )
}

/** A number that turns into an input when clicked. Enter or leaving saves, Escape cancels. */
function NumberEdit(props: {
  value: number
  min: number
  title: string
  className?: string
  autoEdit?: boolean
  onCommit: (value: number) => void
}): ReactNode {
  const [draft, setDraft] = useState<string | null>(props.autoEdit ? String(props.value) : null)
  const cancelled = useRef(false)

  if (draft === null) {
    return (
      <button
        type="button"
        className={cls('num-edit', props.className)}
        title={props.title}
        onClick={() => {
          cancelled.current = false
          setDraft(String(props.value))
        }}
      >
        {props.value}
      </button>
    )
  }

  const commit = (): void => {
    const n = Number.parseInt(draft, 10)
    if (!cancelled.current && Number.isFinite(n) && n >= props.min && n !== props.value) props.onCommit(n)
    setDraft(null)
  }

  return (
    <input
      autoFocus
      inputMode="numeric"
      className={cls('num-edit', 'editing', props.className)}
      value={draft}
      size={Math.max(2, draft.length)}
      onFocus={(e) => e.target.select()}
      onChange={(e) => setDraft(e.target.value.replace(/\D/g, ''))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          e.currentTarget.blur()
        } else if (e.key === 'Escape') {
          e.stopPropagation()
          cancelled.current = true
          e.currentTarget.blur()
        }
      }}
    />
  )
}

/** Weekday 16:00 prompt: tick off work tasks that were finished but never marked. */
export function WorkCheck({ ids, onClose }: { ids: string[]; onClose: () => void }): ReactNode {
  const data = useData()
  const tasks = ids.map((id) => data.tasks.find((t) => t.id === id)).filter((t): t is Task => !!t)
  const open = tasks.filter((t) => !t.done)

  return (
    <div
      className="overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <div className="dialog" role="dialog" aria-modal="true">
        <h2>Work check</h2>
        <p>These work tasks are still open. Did you finish any and forget to tick them?</p>
        <div className="check-list">
          {tasks.map((t) => (
            <label key={t.id} className={cls('check-row', t.done && 'done')}>
              <Checkbox checked={t.done} onChange={() => toggleTask(t.id)} />
              <span>{t.title || 'Untitled'}</span>
            </label>
          ))}
        </div>
        <div className="dialog-actions">
          {open.length > 1 && (
            <button type="button" className="btn" onClick={() => open.forEach((t) => toggleTask(t.id))}>
              All done
            </button>
          )}
          <button type="button" className="btn primary" autoFocus onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
