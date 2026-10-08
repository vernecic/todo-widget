import { closestCenter, DndContext, PointerSensor, useSensor, useSensors, type Modifier } from '@dnd-kit/core'
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Plus, Trash2, X } from 'lucide-react'
import { useState, type CSSProperties, type ReactNode } from 'react'
import {
  addSubtask,
  CATEGORIES,
  CATEGORY_LABEL,
  moveTask,
  removeSubtask,
  renameSubtask,
  reorderSubtasks,
  setRepeat,
  setStatus,
  STATUS_LABEL,
  STATUSES,
  taskStatus,
  toggleSubtask,
  updateTask
} from '../lib/actions'
import { PRIORITIES } from '../lib/colors'
import { WEEK, weekday } from '../lib/dates'
import { confirmDelete, nextDayTarget, promptNewProject } from '../lib/flows'
import { useData } from '../lib/store'
import type { Category, Series, Subtask, Task } from '../lib/types'
import { AutoTextarea, Checkbox, cls } from './bits'

const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 })

export function TaskDetails({ task, series }: { task: Task; series: Series | undefined }): ReactNode {
  const data = useData()
  const next = nextDayTarget(task)

  const onProject = async (value: string): Promise<void> => {
    if (value === '__new') {
      const id = await promptNewProject()
      if (id) updateTask(task.id, { projectId: id })
    } else {
      updateTask(task.id, { projectId: value || null })
    }
  }

  const onRepeat = (value: string): void => {
    if (value === 'none') setRepeat(task.id, null)
    else if (value === 'daily') setRepeat(task.id, { kind: 'daily' })
    else setRepeat(task.id, { kind: 'weekly', days: [weekday(task.date)] })
  }

  const toggleDay = (day: number): void => {
    if (series?.repeat.kind !== 'weekly') return
    const days = series.repeat.days.includes(day)
      ? series.repeat.days.filter((d) => d !== day)
      : [...series.repeat.days, day]
    if (days.length) setRepeat(task.id, { kind: 'weekly', days })
  }

  return (
    <div className="details" onClick={(e) => e.stopPropagation()}>
      <AutoTextarea
        className="notes"
        value={task.notes}
        placeholder="Notes"
        onChange={(notes) => updateTask(task.id, { notes })}
      />

      <SubtaskList task={task} />

      <div className="fields">
        <label>Status</label>
        <div className="seg" role="group" aria-label="Status">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              className={cls('seg-btn', s, taskStatus(task) === s && 'on')}
              aria-pressed={taskStatus(task) === s}
              onClick={() => setStatus(task.id, s)}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>

        <label>Day</label>
        <input
          type="date"
          className="field-input"
          value={task.date}
          onChange={(e) => e.target.value && moveTask(task.id, e.target.value)}
        />

        <label>List</label>
        <select
          className="field-input"
          value={task.category}
          onChange={(e) => updateTask(task.id, { category: e.target.value as Category })}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>

        <label>Project</label>
        <select className="field-input" value={task.projectId ?? ''} onChange={(e) => onProject(e.target.value)}>
          <option value="">None</option>
          {data.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
          <option value="__new">New project…</option>
        </select>

        <label>Priority</label>
        <div className="prio-pick">
          {PRIORITIES.map((p) => (
            <button
              key={p.value}
              type="button"
              title={p.label}
              className={cls('prio-dot', p.value === 0 && 'none', task.priority === p.value && 'selected')}
              style={{ '--c': p.color } as CSSProperties}
              onClick={() => updateTask(task.id, { priority: p.value })}
            />
          ))}
          <span className="prio-name">{PRIORITIES[task.priority].label}</span>
        </div>

        <label>Reminder</label>
        <div className="inline">
          <input
            type="time"
            className="field-input"
            value={task.reminder ?? ''}
            onChange={(e) => updateTask(task.id, { reminder: e.target.value || null })}
          />
          {task.reminder && (
            <button type="button" className="icon-btn small" title="Remove reminder" onClick={() => updateTask(task.id, { reminder: null })}>
              <X />
            </button>
          )}
        </div>

        <label>Repeat</label>
        <div className="inline wrap">
          <select className="field-input" value={series?.repeat.kind ?? 'none'} onChange={(e) => onRepeat(e.target.value)}>
            <option value="none">Never</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
          {series?.repeat.kind === 'weekly' && (
            <div className="weekdays">
              {WEEK.map((w) => (
                <button
                  key={w.day}
                  type="button"
                  className={cls('weekday', series.repeat.kind === 'weekly' && series.repeat.days.includes(w.day) && 'on')}
                  onClick={() => toggleDay(w.day)}
                >
                  {w.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="detail-actions">
        <button type="button" className="btn ghost" onClick={() => moveTask(task.id, next.date)}>
          {next.label}
        </button>
        <button type="button" className="btn ghost danger" onClick={() => confirmDelete(task)}>
          <Trash2 /> Delete
        </button>
      </div>
    </div>
  )
}

function SubtaskList({ task }: { task: Task }): ReactNode {
  const [draft, setDraft] = useState('')
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))
  const ids = task.subtasks.map((s) => s.id)

  return (
    <div className="subtasks">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[verticalOnly]}
        onDragEnd={({ active, over }) => {
          if (!over || active.id === over.id) return
          reorderSubtasks(task.id, arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))))
        }}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {task.subtasks.map((s) => (
            <SubtaskRow key={s.id} taskId={task.id} sub={s} />
          ))}
        </SortableContext>
      </DndContext>
      <form
        className="sub-add"
        onSubmit={(e) => {
          e.preventDefault()
          if (!draft.trim()) return
          addSubtask(task.id, draft.trim())
          setDraft('')
        }}
      >
        <Plus />
        <input value={draft} placeholder="Add subtask" onChange={(e) => setDraft(e.target.value)} />
      </form>
    </div>
  )
}

function SubtaskRow({ taskId, sub }: { taskId: string; sub: Subtask }): ReactNode {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: sub.id
  })
  return (
    <div
      ref={setNodeRef}
      className={cls('sub', sub.done && 'done', isDragging && 'drag-source')}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      <span className="grip" ref={setActivatorNodeRef} {...attributes} {...listeners} title="Drag to reorder">
        <GripVertical />
      </span>
      <Checkbox small checked={sub.done} onChange={() => toggleSubtask(taskId, sub.id)} />
      <input
        value={sub.title}
        onChange={(e) => renameSubtask(taskId, sub.id, e.target.value)}
        onBlur={(e) => !e.target.value.trim() && removeSubtask(taskId, sub.id)}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
      <button type="button" className="icon-btn small remove" title="Remove subtask" onClick={() => removeSubtask(taskId, sub.id)}>
        <X />
      </button>
    </div>
  )
}
