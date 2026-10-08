import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Bell, ChevronDown, GripVertical, Repeat, StickyNote, CalendarArrowUp } from 'lucide-react'
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react'
import { cyclePriority, liveSeries, toggleTask, updateTask } from '../lib/actions'
import { PRIORITIES } from '../lib/colors'
import { formatShort } from '../lib/dates'
import { confirmDelete, taskMenuItems } from '../lib/flows'
import { useData } from '../lib/store'
import type { Task } from '../lib/types'
import { openMenu } from '../lib/ui'
import { Checkbox, cls, ProjectPill } from './bits'
import { TaskDetails } from './TaskDetails'

interface Handle {
  ref: (el: HTMLElement | null) => void
  listeners: DraggableSyntheticListeners
  attributes: DraggableAttributes
}

export interface TaskItemProps {
  task: Task
  expanded: boolean
  onToggleExpand: () => void
  flash?: boolean
  overlay?: boolean
  handle?: Handle
}

export function TaskItem({ task, expanded, onToggleExpand, flash, overlay, handle }: TaskItemProps): ReactNode {
  const data = useData()
  const project = task.projectId ? data.projects.find((p) => p.id === task.projectId) : undefined
  const series = liveSeries(data, task)
  const prio = PRIORITIES[task.priority]
  const subsDone = task.subtasks.filter((s) => s.done).length
  const open = expanded && !overlay

  const onKey = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.target !== e.currentTarget) return
    if (e.key === 'Delete') confirmDelete(task)
    if (e.key === 'Enter') onToggleExpand()
  }

  const meta = [
    task.doing && !task.done && (
      <span key="d" className="meta-item doing-badge">
        Doing
      </span>
    ),
    project && <ProjectPill key="p" project={project} />,
    task.subtasks.length > 0 && (
      <span key="s" className={cls('meta-item', subsDone === task.subtasks.length && 'complete')}>
        {subsDone}/{task.subtasks.length}
      </span>
    ),
    task.notes.trim() && (
      <span key="n" className="meta-item" title="Has notes">
        <StickyNote />
      </span>
    ),
    task.reminder && (
      <span key="r" className="meta-item" title="Reminder">
        <Bell />
        {task.reminder}
      </span>
    ),
    series && (
      <span key="rep" className="meta-item" title={series.repeat.kind === 'daily' ? 'Repeats daily' : 'Repeats weekly'}>
        <Repeat />
      </span>
    ),
    task.rolledFrom && (
      <span key="roll" className="meta-item rolled" title="Not finished on its original day">
        <CalendarArrowUp />
        from {formatShort(task.rolledFrom)}
      </span>
    )
  ].filter(Boolean)

  return (
    <div
      data-task={task.id}
      tabIndex={0}
      onKeyDown={onKey}
      onContextMenu={(e) => openMenu(e, taskMenuItems(task))}
      className={cls('task', task.done && 'done', task.doing && !task.done && 'doing', open && 'open', flash && 'flash', overlay && 'overlay')}
      style={{ '--prio': prio.color } as CSSProperties}
    >
      <button
        type="button"
        className={cls('prio', task.priority === 0 && 'none')}
        title={`Priority: ${prio.label}. Click to change.`}
        onClick={() => cyclePriority(task.id)}
      />
      <div className="task-body">
        <div className="task-head" onClick={onToggleExpand}>
          {handle ? (
            <span
              className="grip"
              ref={handle.ref}
              {...handle.attributes}
              {...handle.listeners}
              onClick={(e) => e.stopPropagation()}
              title="Drag to reorder, or drop on the day arrows to move a day"
            >
              <GripVertical />
            </span>
          ) : (
            <span className="grip placeholder" />
          )}
          <Checkbox checked={task.done} doing={task.doing} onChange={() => toggleTask(task.id)} />
          <div className="task-text">
            {open ? (
              <input
                className="title-input"
                value={task.title}
                placeholder="Task name"
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => updateTask(task.id, { title: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              />
            ) : (
              <span className="task-title">{task.title || 'Untitled'}</span>
            )}
            {meta.length > 0 && <div className="meta">{meta}</div>}
          </div>
          <span className="chev" aria-hidden>
            <ChevronDown />
          </span>
        </div>
        {open && <TaskDetails task={task} series={series} />}
      </div>
    </div>
  )
}

export function SortableTask(props: Omit<TaskItemProps, 'handle'>): ReactNode {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: props.task.id
  })
  return (
    <div
      ref={setNodeRef}
      className={cls('sortable', isDragging && 'drag-source')}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      <TaskItem {...props} handle={{ ref: setActivatorNodeRef, listeners, attributes }} />
    </div>
  )
}
