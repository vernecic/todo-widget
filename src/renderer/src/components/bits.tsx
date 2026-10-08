import { Check } from 'lucide-react'
import { useLayoutEffect, useRef, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react'
import { projectColor } from '../lib/colors'
import type { Project } from '../lib/types'

export const cls = (...names: (string | false | null | undefined)[]): string => names.filter(Boolean).join(' ')

/** Round tick box. `doing` draws a filled dot to show the task is in progress. */
export function Checkbox(props: { checked: boolean; onChange: () => void; small?: boolean; doing?: boolean }): ReactNode {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={props.checked}
      className={cls('check', props.checked && 'on', props.doing && !props.checked && 'doing', props.small && 'small')}
      title={props.checked ? 'Mark as not done' : 'Mark as done'}
      onClick={(e) => {
        e.stopPropagation()
        props.onChange()
      }}
    >
      {props.checked && <Check strokeWidth={3} />}
    </button>
  )
}

export function IconButton({
  active,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }): ReactNode {
  return <button type="button" className={cls('icon-btn', active && 'active', className)} {...rest} />
}

export function ProjectPill({ project }: { project: Project }): ReactNode {
  const c = projectColor(project.color)
  return (
    <span className="pill" style={{ '--pill-bg': c.bg, '--pill-fg': c.fg } as CSSProperties}>
      {project.name}
    </span>
  )
}

export function AutoTextarea(props: {
  value: string
  placeholder?: string
  className?: string
  onChange: (value: string) => void
}): ReactNode {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [props.value])
  return (
    <textarea
      ref={ref}
      rows={1}
      className={props.className}
      value={props.value}
      placeholder={props.placeholder}
      onChange={(e) => props.onChange(e.target.value)}
    />
  )
}
