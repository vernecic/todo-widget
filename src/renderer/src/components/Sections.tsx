import { useDroppable } from '@dnd-kit/core'
import { ChevronDown } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { addToCounter, CATEGORY_LABEL, COUNTER_TARGETS, setCategoryCollapsed, tallyFor, toggleTask } from '../lib/actions'
import { useData } from '../lib/store'
import type { Category, Task } from '../lib/types'
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
  const values = tallyFor(data, date)
  return (
    <div className="counters">
      {COUNTER_TARGETS.map((target, i) => (
        <Counter key={i} value={values[i]} target={target} onAdd={(n) => addToCounter(date, i, n)} />
      ))}
    </div>
  )
}

function Counter(props: { value: number; target: number; onAdd: (amount: number) => void }): ReactNode {
  const [draft, setDraft] = useState('')
  const { value, target } = props
  return (
    <form
      className={cls('counter', value >= target && 'complete')}
      title="Type a number and press Enter to add it. Use -5 to take 5 away."
      onSubmit={(e) => {
        e.preventDefault()
        const n = Number.parseInt(draft, 10)
        if (Number.isFinite(n) && n !== 0) props.onAdd(n)
        setDraft('')
      }}
    >
      <div className="counter-num">
        <strong>{value}</strong> / {target}
      </div>
      <div className="counter-bar">
        <span style={{ width: `${Math.min(100, (value / target) * 100)}%` }} />
      </div>
      <input
        inputMode="numeric"
        value={draft}
        placeholder="+ add"
        onChange={(e) => setDraft(e.target.value.replace(/[^\d-]/g, ''))}
      />
    </form>
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
