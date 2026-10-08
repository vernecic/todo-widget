import { X } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { projectColor } from '../lib/colors'
import { formatDay, fromKey } from '../lib/dates'
import {
  counterStreaks,
  doneByDay,
  FREE_SLICE,
  gridWeeks,
  levelScale,
  OTHER_SLICE,
  RANGE_LABEL,
  streaks,
  timeSlices,
  type Slice,
  type TimeRange
} from '../lib/stats'
import { useData } from '../lib/store'
import { cls, IconButton } from './bits'
import { formatDuration, useNow } from './Timer'

interface Tip {
  x: number
  y: number
  title: string
  lines?: string[]
}

/** Hover card that follows the pointer and stays inside the window. */
function TipBox({ tip }: { tip: Tip | null }): ReactNode {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: 0, top: 0 })
  useLayoutEffect(() => {
    if (!tip || !ref.current) return
    const { width, height } = ref.current.getBoundingClientRect()
    setPos({
      left: Math.max(6, Math.min(tip.x + 12, window.innerWidth - width - 6)),
      top: tip.y + 14 + height > window.innerHeight ? tip.y - height - 8 : tip.y + 14
    })
  }, [tip])
  if (!tip) return null
  return (
    <div ref={ref} className="chart-tip" style={pos} role="tooltip">
      <strong>{tip.title}</strong>
      {tip.lines?.map((l, i) => (
        <span key={i}>{l}</span>
      ))}
    </div>
  )
}

export function ChartsPanel(props: { today: string; onPickDay: (date: string) => void; onClose: () => void }): ReactNode {
  const [tip, setTip] = useState<Tip | null>(null)
  const { onClose } = props

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !document.querySelector('.overlay')) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="charts-view">
      <div className="notes-head">
        <h2 className="view-title">Charts</h2>
        <IconButton title="Back to tasks" onClick={onClose}>
          <X />
        </IconButton>
      </div>
      <div className="list" onScroll={() => setTip(null)}>
        <DoneGrid today={props.today} onPickDay={props.onPickDay} onTip={setTip} />
        <TimeDonut today={props.today} onTip={setTip} />
        <CounterStreaks today={props.today} />
      </div>
      <TipBox tip={tip} />
    </div>
  )
}

// ---------- tasks done grid ----------

const WEEKS = 53
const CELL = 11
const GAP = 3
const STEP = CELL + GAP
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function DoneGrid(props: { today: string; onPickDay: (date: string) => void; onTip: (tip: Tip | null) => void }): ReactNode {
  const data = useData()
  const { today } = props
  const scroller = useRef<HTMLDivElement>(null)

  const { weeks, counts, level, total, best, current } = useMemo(() => {
    const weeks = gridWeeks(today, WEEKS)
    const counts = doneByDay(data)
    const days = weeks.flat().filter((d) => d <= today)
    const level = levelScale(days.map((d) => counts.get(d) ?? 0))
    const total = days.reduce((sum, d) => sum + (counts.get(d) ?? 0), 0)
    const { longest, current } = streaks(days[0], today, (d) => (counts.get(d) ?? 0) > 0)
    return { weeks, counts, level, total, best: longest, current }
  }, [data, today])

  // Newest weeks are on the right: start scrolled there in a narrow window.
  useLayoutEffect(() => {
    const el = scroller.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [])

  const width = weeks.length * STEP
  const height = 16 + 7 * STEP

  return (
    <section className="chart-card">
      <h3>Tasks done</h3>
      <p className="chart-sub">
        {total} in the last 12 months · longest streak {best} {best === 1 ? 'day' : 'days'} · current {current}
      </p>
      <div className="grid-wrap">
        <svg className="grid-days" style={{ width: 28, height }} aria-hidden>
          {['Mon', 'Wed', 'Fri'].map((label, i) => (
            <text key={label} x={0} y={16 + (i * 2) * STEP + CELL - 1}>
              {label}
            </text>
          ))}
        </svg>
        <div className="grid-scroll" ref={scroller} onMouseLeave={() => props.onTip(null)}>
          <svg style={{ width, height }} role="img" aria-label={`Tasks done per day: ${total} in the last 12 months`}>
            {weeks.map((week, w) => {
              const first = fromKey(week[0])
              const prev = w > 0 ? fromKey(weeks[w - 1][0]) : null
              const showMonth = (!prev || prev.getMonth() !== first.getMonth()) && w < weeks.length - 2
              return (
                <g key={week[0]}>
                  {showMonth && (
                    <text className="grid-month" x={w * STEP} y={10}>
                      {MONTHS[first.getMonth()]}
                    </text>
                  )}
                  {week.map((day, i) => {
                    if (day > today) return null
                    const n = counts.get(day) ?? 0
                    return (
                      <rect
                        key={day}
                        className={cls('grid-cell', `lv${level(n)}`, day === today && 'today')}
                        x={w * STEP}
                        y={16 + i * STEP}
                        width={CELL}
                        height={CELL}
                        rx={2}
                        onMouseMove={(e) =>
                          props.onTip({ x: e.clientX, y: e.clientY, title: `${formatDay(day)} · ${n} ${n === 1 ? 'task' : 'tasks'} done` })
                        }
                        onClick={() => props.onPickDay(day)}
                      />
                    )
                  })}
                </g>
              )
            })}
          </svg>
        </div>
      </div>
      <div className="grid-legend" aria-hidden>
        Less
        {[0, 1, 2, 3, 4].map((l) => (
          <span key={l} className={cls('grid-swatch', `lv${l}`)} />
        ))}
        More
      </div>
    </section>
  )
}

// ---------- time donut ----------

const RANGES: TimeRange[] = ['today', 'week', 'month', 'all']
const SIZE = 168
const R_OUT = 78
const R_IN = 54

function polar(r: number, angle: number): [number, number] {
  return [SIZE / 2 + r * Math.cos(angle), SIZE / 2 + r * Math.sin(angle)]
}

/** Ring segment from angle a0 to a1 (radians, clockwise from 12 o'clock). */
function arcPath(a0: number, a1: number): string {
  const [x0, y0] = polar(R_OUT, a0)
  const [x1, y1] = polar(R_OUT, a1)
  const [x2, y2] = polar(R_IN, a1)
  const [x3, y3] = polar(R_IN, a0)
  const large = a1 - a0 > Math.PI ? 1 : 0
  return `M${x0} ${y0} A${R_OUT} ${R_OUT} 0 ${large} 1 ${x1} ${y1} L${x2} ${y2} A${R_IN} ${R_IN} 0 ${large} 0 ${x3} ${y3}Z`
}

function sliceFill(slice: Slice, colorOf: (key: string) => string): string {
  if (slice.key === FREE_SLICE) return 'var(--chart-free)'
  if (slice.key === OTHER_SLICE) return 'url(#hatch-other)'
  return colorOf(slice.key)
}

function TimeDonut(props: { today: string; onTip: (tip: Tip | null) => void }): ReactNode {
  const data = useData()
  const [range, setRange] = useState<TimeRange>('week')
  const [withFree, setWithFree] = useState(true)
  const [active, setActive] = useState<string | null>(null)
  const ticking = data.sessions.some((s) => s.end === null)
  const now = useNow(ticking, 30_000)
  const dark = data.settings.theme === 'dark'

  const slices = useMemo(() => timeSlices(data, range, props.today, now, withFree), [data, range, props.today, now, withFree])
  const total = slices.reduce((sum, s) => sum + s.ms, 0)
  const colorOf = (key: string): string => {
    const p = data.projects.find((x) => x.id === key)
    const c = projectColor(p?.color ?? 0)
    return dark ? c.chartDark : c.chart
  }
  const pct = (ms: number): string => `${Math.round((ms / total) * 100)}%`
  const shown = slices.find((s) => s.key === active)

  const hover = (s: Slice | null, e?: { clientX: number; clientY: number }): void => {
    setActive(s?.key ?? null)
    if (!s || !e) return props.onTip(null)
    props.onTip({
      x: e.clientX,
      y: e.clientY,
      title: `${s.label} · ${formatDuration(s.ms)} · ${pct(s.ms)}`,
      lines: [
        ...s.items.slice(0, 5).map((it) => `${it.label} · ${formatDuration(it.ms)}`),
        ...(s.items.length > 5 ? [`and ${s.items.length - 5} more`] : [])
      ]
    })
  }

  let angle = -Math.PI / 2
  const arcs = slices.map((s) => {
    const sweep = (s.ms / total) * Math.PI * 2
    const a0 = angle
    angle += sweep
    return { s, a0, a1: angle }
  })

  return (
    <section className="chart-card">
      <h3>Time</h3>
      <div className="chart-filters">
        <div className="seg" role="group" aria-label="Range">
          {RANGES.map((r) => (
            <button key={r} type="button" className={cls('seg-btn', range === r && 'on')} aria-pressed={range === r} onClick={() => setRange(r)}>
              {RANGE_LABEL[r]}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={cls('chip-toggle', withFree && 'on')}
          aria-pressed={withFree}
          title="Include Free time in the chart"
          onClick={() => setWithFree((v) => !v)}
        >
          <span className="chip-dot" /> Free time
        </button>
      </div>

      {total === 0 ? (
        <p className="empty small">No time tracked {range === 'all' ? 'yet' : `${RANGE_LABEL[range].toLowerCase()}`}. Start a timer with ▶ on a task.</p>
      ) : (
        <div className="donut-wrap">
          <svg className="donut" style={{ width: SIZE, height: SIZE }} role="img" aria-label={`Time by project, ${RANGE_LABEL[range]}: ${formatDuration(total)} total`}>
            <defs>
              <pattern id="hatch-other" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="6" height="6" fill="var(--chart-other)" />
                <line x1="0" y1="0" x2="0" y2="6" stroke="var(--surface)" strokeWidth="2" />
              </pattern>
            </defs>
            {arcs.map(({ s, a0, a1 }) => {
              const dim = active && active !== s.key
              const common = {
                fill: sliceFill(s, colorOf),
                className: cls('donut-slice', dim && 'dim'),
                onMouseMove: (e: MouseEvent) => hover(s, e),
                onMouseLeave: () => hover(null)
              }
              // A lone slice is a full ring; an arc path cannot draw 360°.
              return arcs.length === 1 ? (
                <path key={s.key} {...common} d={`${arcPath(-Math.PI / 2, Math.PI / 2)} ${arcPath(Math.PI / 2, (3 * Math.PI) / 2)}`} />
              ) : (
                <path key={s.key} {...common} d={arcPath(a0, a1)} />
              )
            })}
            <text className="donut-total" x={SIZE / 2} y={SIZE / 2 - 2}>
              {formatDuration(shown?.ms ?? total)}
            </text>
            <text className="donut-label" x={SIZE / 2} y={SIZE / 2 + 15}>
              {shown ? pct(shown.ms) : 'tracked'}
            </text>
          </svg>
          <ul className="donut-legend">
            {slices.map((s) => (
              <li
                key={s.key}
                className={cls(active && active !== s.key && 'dim')}
                onMouseMove={(e) => hover(s, e)}
                onMouseLeave={() => hover(null)}
              >
                <span className={cls('legend-swatch', s.key === OTHER_SLICE && 'hatched')} style={{ background: s.key === OTHER_SLICE ? undefined : sliceFill(s, colorOf) }} />
                <span className="legend-name">{s.label}</span>
                <span className="legend-value">{formatDuration(s.ms)}</span>
                <span className="legend-pct">{pct(s.ms)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

// ---------- counter streaks ----------

function CounterStreaks({ today }: { today: string }): ReactNode {
  const data = useData()
  if (!data.counters.length) return null
  return (
    <section className="chart-card">
      <h3>Counter streaks</h3>
      <p className="chart-sub">Days in a row each counter reached its goal.</p>
      <ul className="streak-list">
        {data.counters.map((c) => {
          const { current, longest } = counterStreaks(data, c, today)
          return (
            <li key={c.id}>
              <span className="legend-name">{c.name}</span>
              <span className="legend-value">{current >= 1 ? `🔥 ${current}` : '–'}</span>
              <span className="legend-pct">best {longest}</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
