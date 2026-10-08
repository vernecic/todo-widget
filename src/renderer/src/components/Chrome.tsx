import { useDroppable } from '@dnd-kit/core'
import {
  AppWindow,
  ChevronLeft,
  ChevronRight,
  Minus,
  Moon,
  NotebookPen,
  PictureInPicture2,
  Pin,
  PinOff,
  Plus,
  Search,
  Sun,
  Tag,
  X
} from 'lucide-react'
import { useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { WindowState } from '../../../shared/api'
import { addTask, CATEGORY_LABEL, setAddCategory, toggleTheme } from '../lib/actions'
import { PRIORITIES } from '../lib/colors'
import { addDays, formatDay, relativeLabel } from '../lib/dates'
import { parseQuick } from '../lib/parse'
import { useData } from '../lib/store'
import { cls, IconButton } from './bits'

export function TitleBar(props: {
  win: WindowState
  theme: 'light' | 'dark'
  searching: boolean
  notesOpen: boolean
  onSearch: () => void
  onNotes: () => void
  onProjects: () => void
}): ReactNode {
  const { win, theme } = props
  const widget = win.mode === 'widget'
  return (
    <header className="titlebar">
      <div className="brand">{widget ? '' : 'Todo'}</div>
      <div className="tb-actions">
        <IconButton title="Search all tasks" active={props.searching} onClick={props.onSearch}>
          <Search />
        </IconButton>
        <IconButton title="Notes: what you were doing each hour" active={props.notesOpen} onClick={props.onNotes}>
          <NotebookPen />
        </IconButton>
        <IconButton title="Projects" onClick={props.onProjects}>
          <Tag />
        </IconButton>
        <IconButton title={theme === 'dark' ? 'Light mode' : 'Dark mode'} onClick={toggleTheme}>
          {theme === 'dark' ? <Sun /> : <Moon />}
        </IconButton>
        {widget && (
          <IconButton
            title={win.pinned ? 'Stop keeping on top' : 'Keep on top of other windows'}
            active={win.pinned}
            onClick={() => window.api.setPinned(!win.pinned)}
          >
            {win.pinned ? <Pin /> : <PinOff />}
          </IconButton>
        )}
        <IconButton
          title={widget ? 'Open as full window' : 'Switch to widget'}
          onClick={() => window.api.setMode(widget ? 'normal' : 'widget')}
        >
          {widget ? <AppWindow /> : <PictureInPicture2 />}
        </IconButton>
        {!widget && (
          <IconButton title="Minimize" onClick={() => window.api.minimize()}>
            <Minus />
          </IconButton>
        )}
        <IconButton title="Close to tray" className="close" onClick={() => window.api.hide()}>
          <X />
        </IconButton>
      </div>
    </header>
  )
}

function DayArrow({ id, title, onClick, children }: { id: string; title: string; onClick: () => void; children: ReactNode }): ReactNode {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <button ref={setNodeRef} type="button" className={cls('day-arrow', isOver && 'over')} title={title} onClick={onClick}>
      {children}
    </button>
  )
}

export function DayNav(props: {
  date: string
  today: string
  dragging: boolean
  onChange: (date: string) => void
}): ReactNode {
  const { date, today, onChange } = props
  const picker = useRef<HTMLInputElement>(null)
  const rel = relativeLabel(date, today)
  return (
    <nav className={cls('daynav', props.dragging && 'is-dragging')}>
      <DayArrow id="day-prev" title="Previous day. Drop a task here to move it back a day." onClick={() => onChange(addDays(date, -1))}>
        <ChevronLeft />
      </DayArrow>
      <div className="day-center">
        <button type="button" className="day-label" title="Pick a day" onClick={() => picker.current?.showPicker()}>
          <span className="day-main">{formatDay(date)}</span>
          <span className={cls('day-rel', date === today && 'is-today')}>{rel ?? ' '}</span>
        </button>
        <input
          ref={picker}
          type="date"
          className="hidden-picker"
          tabIndex={-1}
          value={date}
          onChange={(e) => e.target.value && onChange(e.target.value)}
        />
      </div>
      <DayArrow id="day-next" title="Next day. Drop a task here to move it forward a day." onClick={() => onChange(addDays(date, 1))}>
        <ChevronRight />
      </DayArrow>
    </nav>
  )
}

export function AddBar({ date, onAdded }: { date: string; onAdded: (id: string) => void }): ReactNode {
  const [text, setText] = useState('')
  const parsed = parseQuick(text)
  const category = useData().settings.addCategory
  return (
    <form
      className="addbar"
      onSubmit={(e) => {
        e.preventDefault()
        if (!parsed.title) return
        onAdded(addTask({ ...parsed, date, category }))
        setText('')
      }}
    >
      <Plus />
      <input
        value={text}
        placeholder="Add a task   #project  !  !!  !!!"
        onChange={(e) => setText(e.target.value)}
      />
      {(parsed.project || parsed.priority > 0) && (
        <span className="add-preview">
          {parsed.priority > 0 && (
            <span
              className="prio-dot tiny"
              title={PRIORITIES[parsed.priority].label}
              style={{ '--c': PRIORITIES[parsed.priority].color } as CSSProperties}
            />
          )}
          {parsed.project && <span className="add-project">#{parsed.project}</span>}
        </span>
      )}
      <button
        type="button"
        className={cls('cat-toggle', category)}
        title="List new tasks go to. Click to switch."
        onClick={() => setAddCategory(category === 'work' ? 'free' : 'work')}
      >
        {CATEGORY_LABEL[category]}
      </button>
    </form>
  )
}
