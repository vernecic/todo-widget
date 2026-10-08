import {
  closestCenter,
  DndContext,
  DragOverlay,
  pointerWithin,
  PointerSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent
} from '@dnd-kit/core'
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { ChevronDown } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { WindowState } from '../../shared/api'
import { cls } from './components/bits'
import { AddBar, DayNav, TitleBar } from './components/Chrome'
import { CheckInPrompt, NotesPanel, type CheckInSlot } from './components/CheckIns'
import { ContextMenu, Dialog } from './components/Overlays'
import { ProjectsPanel, SearchPanel } from './components/Panels'
import { CategorySection, Counters, WorkCheck } from './components/Sections'
import { SortableTask, TaskItem } from './components/TaskItem'
import {
  addCheckIn,
  CATEGORIES,
  ensureInstances,
  moveTask,
  reorderDay,
  rollover,
  setCategoryCollapsed,
  setDoneCollapsed,
  takeDueReminders,
  takeHourlyCheckIn,
  takeWorkCheck
} from './lib/actions'
import { addDays, todayKey } from './lib/dates'
import { getData, loadError, saveNow, useData } from './lib/store'
import type { Category } from './lib/types'

const isDayTarget = (id: unknown): boolean => id === 'day-prev' || id === 'day-next'
const isSection = (id: unknown): boolean => String(id).startsWith('section-')
const isFixedTarget = (id: unknown): boolean => isDayTarget(id) || isSection(id)

/** Day arrows and list headers win when the pointer is over them; otherwise sort among tasks. */
const collision: CollisionDetection = (args) => {
  const fixed = pointerWithin(args).filter((c) => isFixedTarget(c.id))
  if (fixed.length) return fixed
  return closestCenter({ ...args, droppableContainers: args.droppableContainers.filter((c) => !isFixedTarget(c.id)) })
}

function useToday(): string {
  const [today, setToday] = useState(todayKey)
  useEffect(() => {
    const check = (): void => setToday(todayKey())
    const timer = window.setInterval(check, 30_000)
    window.addEventListener('focus', check)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', check)
    }
  }, [])
  return today
}

export function App(): ReactNode {
  const data = useData()
  const today = useToday()
  const [date, setDate] = useState(today)
  const [win, setWin] = useState<WindowState>({ mode: 'normal', pinned: true })
  const [searching, setSearching] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const [checkIn, setCheckIn] = useState<CheckInSlot | null>(null)
  const checkInRef = useRef<CheckInSlot | null>(null)
  const [projectsOpen, setProjectsOpen] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [workCheck, setWorkCheck] = useState<string[] | null>(null)
  const lastToday = useRef(today)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  // Window state and quit handshake with the main process.
  useEffect(() => {
    window.api.getWindowState().then(setWin)
    const offState = window.api.onWindowState(setWin)
    const offFlush = window.api.onFlush(async () => {
      await saveNow()
      window.api.flushed()
    })
    return () => {
      offState()
      offFlush()
    }
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = data.settings.theme
    window.api.setTheme(data.settings.theme)
  }, [data.settings.theme])

  useEffect(() => {
    document.documentElement.dataset.mode = win.mode
  }, [win.mode])

  // New day: roll unfinished tasks forward and follow along if we were looking at "today".
  useEffect(() => {
    rollover(today)
    setDate((d) => (d === lastToday.current ? today : d))
    lastToday.current = today
  }, [today])

  useEffect(() => {
    ensureInstances(date === today ? [today] : [today, date])
  }, [date, today, data.series])

  const openCheckIn = useCallback((slot: CheckInSlot | null) => {
    checkInRef.current = slot
    setCheckIn(slot)
  }, [])

  useEffect(() => {
    const tick = (): void => {
      for (const t of takeDueReminders()) {
        window.api.notify({ taskId: t.id, title: t.title || 'Reminder', body: `Reminder for ${t.reminder}` })
      }
      const open = takeWorkCheck()
      if (open.length) {
        setWorkCheck(open.map((t) => t.id))
        const what = open.length === 1 ? '1 work task is' : `${open.length} work tasks are`
        window.api.notify({ title: 'Work check', body: `${what} still open. Finished any?` })
      }
      const slot = takeHourlyCheckIn()
      if (slot) {
        // An hour went by without an answer: keep that hour in the notes as skipped.
        const unanswered = checkInRef.current
        if (unanswered) addCheckIn(unanswered.date, unanswered.time, '')
        openCheckIn(slot)
        window.api.present()
        window.api.notify({ title: 'What are you doing?', body: `${slot.time} check-in` })
      }
    }
    tick()
    const timer = window.setInterval(tick, 20_000)
    return () => window.clearInterval(timer)
  }, [openCheckIn])

  const focusTask = useCallback((id: string) => {
    const t = getData().tasks.find((x) => x.id === id)
    if (!t) return
    setSearching(false)
    setNotesOpen(false)
    setDate(t.date)
    setExpanded(id)
    setFlash(id)
  }, [])

  useEffect(() => window.api.onFocusTask(focusTask), [focusTask])

  useEffect(() => {
    if (!flash) return
    // Open the list the task sits in so it can be seen.
    const t = getData().tasks.find((x) => x.id === flash)
    if (t && !t.done && getData().settings.collapsed[t.category]) setCategoryCollapsed(t.category, false)
    const frame = requestAnimationFrame(() =>
      document.querySelector(`[data-task="${flash}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    )
    const timer = window.setTimeout(() => setFlash(null), 1400)
    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(timer)
    }
  }, [flash])

  const tasks = data.tasks.filter((t) => t.date === date).sort((a, b) => a.order - b.order)
  const open = tasks.filter((t) => !t.done)
  const done = tasks.filter((t) => t.done)
  const openIn = (c: Category): string[] => open.filter((t) => t.category === c).map((t) => t.id)
  const dragTask = dragId ? tasks.find((t) => t.id === dragId) : undefined

  const onDragEnd = ({ active, over }: DragEndEvent): void => {
    setDragId(null)
    if (!over) return
    const id = String(active.id)
    if (isDayTarget(over.id)) {
      moveTask(id, addDays(date, over.id === 'day-prev' ? -1 : 1))
      return
    }
    const task = open.find((t) => t.id === id)
    const overId = String(over.id)
    const target = isSection(overId) ? (overId.slice('section-'.length) as Category) : open.find((t) => t.id === overId)?.category
    if (!task || !target) return
    const lists: Record<Category, string[]> = { work: openIn('work'), free: openIn('free') }
    if (target === task.category && !isSection(overId)) {
      const ids = lists[target]
      const from = ids.indexOf(id)
      const to = ids.indexOf(overId)
      if (from === to) return
      lists[target] = arrayMove(ids, from, to)
    } else {
      // Dropped on a list header (goes to the top) or on a task in the other list (goes before it).
      lists[task.category] = lists[task.category].filter((x) => x !== id)
      lists[target].splice(isSection(overId) ? 0 : Math.max(0, lists[target].indexOf(overId)), 0, id)
    }
    reorderDay([...lists.work, ...lists.free, ...done.map((t) => t.id)], { id, category: target })
  }

  const toggle = (id: string) => () => setExpanded((cur) => (cur === id ? null : id))
  const goTo = (d: string): void => {
    setDate(d)
    setExpanded(null)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={({ active }) => setDragId(String(active.id))}
      onDragCancel={() => setDragId(null)}
      onDragEnd={onDragEnd}
    >
      <div className="app">
        <TitleBar
          win={win}
          theme={data.settings.theme}
          searching={searching}
          notesOpen={notesOpen}
          onSearch={() => {
            setSearching((s) => !s)
            setNotesOpen(false)
          }}
          onNotes={() => {
            setNotesOpen((n) => !n)
            setSearching(false)
          }}
          onProjects={() => setProjectsOpen(true)}
        />
        {loadError && (
          <div className="banner">Could not read your saved tasks, so changes are not being saved. ({loadError})</div>
        )}

        {searching ? (
          <SearchPanel today={today} onPick={focusTask} onClose={() => setSearching(false)} />
        ) : notesOpen ? (
          <NotesPanel today={today} onAdd={openCheckIn} />
        ) : (
          <>
            <DayNav date={date} today={today} dragging={!!dragId} onChange={goTo} />
            <AddBar date={date} onAdded={setFlash} />
            <div className="list">
              {CATEGORIES.map((c) => {
                const list = open.filter((t) => t.category === c)
                return (
                  <CategorySection key={c} category={c} count={list.length}>
                    {c === 'free' && <Counters date={date} />}
                    <SortableContext items={list.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                      {list.map((t) => (
                        <SortableTask
                          key={t.id}
                          task={t}
                          expanded={expanded === t.id}
                          flash={flash === t.id}
                          onToggleExpand={toggle(t.id)}
                        />
                      ))}
                    </SortableContext>
                    {list.length === 0 && (
                      <p className="empty small">{done.some((t) => t.category === c) ? 'All done.' : 'Nothing here.'}</p>
                    )}
                  </CategorySection>
                )
              })}

              {done.length > 0 && (
                <section className={cls('done-group', data.settings.doneCollapsed && 'collapsed')}>
                  <button type="button" className="done-head" onClick={() => setDoneCollapsed(!data.settings.doneCollapsed)}>
                    <ChevronDown />
                    Done <span className="done-count">{done.length}</span>
                  </button>
                  {!data.settings.doneCollapsed &&
                    done.map((t) => (
                      <TaskItem
                        key={t.id}
                        task={t}
                        expanded={expanded === t.id}
                        flash={flash === t.id}
                        onToggleExpand={toggle(t.id)}
                      />
                    ))}
                </section>
              )}
            </div>
          </>
        )}

        {projectsOpen && <ProjectsPanel onClose={() => setProjectsOpen(false)} />}
        {workCheck && <WorkCheck ids={workCheck} onClose={() => setWorkCheck(null)} />}
        {checkIn && <CheckInPrompt key={`${checkIn.date} ${checkIn.time}`} slot={checkIn} onClose={() => openCheckIn(null)} />}
        <Dialog />
        <ContextMenu />
      </div>
      <DragOverlay dropAnimation={null}>
        {dragTask && <TaskItem task={dragTask} expanded={false} overlay onToggleExpand={() => {}} />}
      </DragOverlay>
    </DndContext>
  )
}
