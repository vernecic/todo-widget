import { Search, Trash2, X } from 'lucide-react'
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { addProject, cycleProjectColor, deleteProject, renameProject } from '../lib/actions'
import { PRIORITIES, projectColor } from '../lib/colors'
import { formatDay, relativeLabel } from '../lib/dates'
import { useData } from '../lib/store'
import type { Task } from '../lib/types'
import { ask } from '../lib/ui'
import { cls, IconButton, ProjectPill } from './bits'

export function SearchPanel(props: { today: string; onPick: (id: string) => void; onClose: () => void }): ReactNode {
  const data = useData()
  const [query, setQuery] = useState('')

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const hits = data.tasks
      .filter((t) => t.title.toLowerCase().includes(q) || t.subtasks.some((s) => s.title.toLowerCase().includes(q)))
      .sort((a, b) => b.date.localeCompare(a.date) || a.order - b.order)
      .slice(0, 300)
    const byDate = new Map<string, Task[]>()
    for (const t of hits) byDate.set(t.date, [...(byDate.get(t.date) ?? []), t])
    return [...byDate.entries()]
  }, [query, data.tasks])

  return (
    <div className="search">
      <div className="search-bar">
        <Search />
        <input
          autoFocus
          value={query}
          placeholder="Search all days"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && props.onClose()}
        />
        <IconButton title="Close search" onClick={props.onClose}>
          <X />
        </IconButton>
      </div>
      <div className="list">
        {groups.map(([date, tasks]) => (
          <section key={date} className="result-group">
            <h3>
              {formatDay(date)}
              {relativeLabel(date, props.today) && <span> · {relativeLabel(date, props.today)}</span>}
            </h3>
            {tasks.map((t) => {
              const project = data.projects.find((p) => p.id === t.projectId)
              return (
                <button key={t.id} type="button" className={cls('result', t.done && 'done')} onClick={() => props.onPick(t.id)}>
                  <span
                    className={cls('prio-dot tiny', t.priority === 0 && 'none')}
                    style={{ '--c': PRIORITIES[t.priority].color } as CSSProperties}
                  />
                  <span className="result-title">{t.title || 'Untitled'}</span>
                  {project && <ProjectPill project={project} />}
                </button>
              )
            })}
          </section>
        ))}
        {query.trim() && groups.length === 0 && <p className="empty">No tasks match "{query.trim()}".</p>}
        {!query.trim() && <p className="empty">Type to search task and subtask names across every day.</p>}
      </div>
    </div>
  )
}

export function ProjectsPanel({ onClose }: { onClose: () => void }): ReactNode {
  const data = useData()
  const [draft, setDraft] = useState('')

  const remove = async (id: string, name: string): Promise<void> => {
    const r = await ask({
      title: 'Delete project?',
      message: `"${name}" is removed from all tasks. The tasks themselves stay.`,
      buttons: [
        { id: 'cancel', label: 'Cancel' },
        { id: 'delete', label: 'Delete', kind: 'danger' }
      ]
    })
    if (r.button === 'delete') deleteProject(id)
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="panel" onKeyDown={(e) => e.key === 'Escape' && onClose()}>
        <header className="panel-head">
          <h2>Projects</h2>
          <IconButton title="Close" onClick={onClose}>
            <X />
          </IconButton>
        </header>
        {data.projects.length === 0 && <p className="empty small">No projects yet. Type #name when adding a task, or add one below.</p>}
        <div className="proj-list">
          {data.projects.map((p) => {
            const count = data.tasks.filter((t) => t.projectId === p.id && !t.done).length
            return (
              <div key={p.id} className="proj-row">
                <button
                  type="button"
                  className="swatch"
                  title={`Color: ${projectColor(p.color).name}. Click to change.`}
                  style={{ background: projectColor(p.color).bg }}
                  onClick={() => cycleProjectColor(p.id)}
                />
                <input
                  value={p.name}
                  onChange={(e) => renameProject(p.id, e.target.value)}
                  onBlur={(e) => !e.target.value.trim() && renameProject(p.id, 'Untitled')}
                />
                <span className="count" title="Open tasks">
                  {count}
                </span>
                <IconButton className="small" title="Delete project" onClick={() => remove(p.id, p.name)}>
                  <Trash2 />
                </IconButton>
              </div>
            )
          })}
        </div>
        <form
          className="sub-add"
          onSubmit={(e) => {
            e.preventDefault()
            if (addProject(draft)) setDraft('')
          }}
        >
          <input value={draft} placeholder="New project name" onChange={(e) => setDraft(e.target.value)} />
        </form>
      </div>
    </div>
  )
}
