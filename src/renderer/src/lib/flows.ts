import { addDays, todayKey } from './dates'
import { addProject, CATEGORY_LABEL, deleteTask, liveSeries, moveTask, setStatus, updateTask } from './actions'
import { getData } from './store'
import { ask, type MenuItem } from './ui'
import type { Task } from './types'

export async function confirmDelete(task: Task): Promise<void> {
  const name = task.title || 'Untitled'
  if (liveSeries(getData(), task) && task.occurrence) {
    const r = await ask({
      title: 'Delete recurring task?',
      message: `"${name}" repeats. Delete only this copy, or this one and every future one?`,
      buttons: [
        { id: 'cancel', label: 'Cancel' },
        { id: 'one', label: 'Only this' },
        { id: 'future', label: 'This and future', kind: 'danger' }
      ]
    })
    if (r.button === 'one' || r.button === 'future') deleteTask(task.id, r.button)
    return
  }
  const r = await ask({
    title: 'Delete task?',
    message: `"${name}" and its subtasks will be removed.`,
    buttons: [
      { id: 'cancel', label: 'Cancel' },
      { id: 'delete', label: 'Delete', kind: 'danger' }
    ]
  })
  if (r.button === 'delete') deleteTask(task.id)
}

export async function promptNewProject(): Promise<string | null> {
  const r = await ask({
    title: 'New project',
    input: { placeholder: 'Project name' },
    buttons: [
      { id: 'cancel', label: 'Cancel' },
      { id: 'ok', label: 'Create', kind: 'primary' }
    ]
  })
  return r.button === 'ok' ? addProject(r.value) : null
}

export function nextDayTarget(task: Task): { label: string; date: string } {
  const today = todayKey()
  return task.date <= today
    ? { label: 'Move to tomorrow', date: addDays(today, 1) }
    : { label: 'Move to next day', date: addDays(task.date, 1) }
}

export function taskMenuItems(task: Task): MenuItem[] {
  const next = nextDayTarget(task)
  const items: MenuItem[] = [
    { label: next.label, onSelect: () => moveTask(task.id, next.date) },
    { kind: 'date', label: 'Pick date…', value: task.date, onPick: (date) => moveTask(task.id, date) }
  ]
  if (task.date !== todayKey()) items.unshift({ label: 'Move to today', onSelect: () => moveTask(task.id, todayKey()) })
  if (!task.done) {
    items.unshift(
      task.doing
        ? { label: 'Stop doing', onSelect: () => setStatus(task.id, 'todo') }
        : { label: 'Mark as doing', onSelect: () => setStatus(task.id, 'doing') },
      { kind: 'separator' }
    )
  }
  const other = task.category === 'work' ? 'free' : 'work'
  items.push({ label: `Move to ${CATEGORY_LABEL[other]}`, onSelect: () => updateTask(task.id, { category: other }) })
  items.push({ kind: 'separator' }, { label: 'Delete…', danger: true, onSelect: () => confirmDelete(task) })
  return items
}
