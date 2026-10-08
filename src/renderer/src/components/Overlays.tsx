import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { dialogSlot, menuSlot, type MenuItem } from '../lib/ui'
import { cls } from './bits'

export function Dialog(): ReactNode {
  const dialog = dialogSlot.use()
  const [value, setValue] = useState('')

  useEffect(() => setValue(''), [dialog])
  if (!dialog) return null

  const close = (button: string | null): void => {
    dialogSlot.set(null)
    dialog.resolve({ button: button === 'cancel' ? null : button, value: value.trim() })
  }
  const primary = dialog.buttons.find((b) => b.kind)?.id ?? null

  return (
    <div
      className="overlay"
      onMouseDown={(e) => e.target === e.currentTarget && close(null)}
      onKeyDown={(e) => e.key === 'Escape' && close(null)}
    >
      <div className="dialog" role="dialog" aria-modal="true">
        <h2>{dialog.title}</h2>
        {dialog.message && <p>{dialog.message}</p>}
        {dialog.input && (
          <input
            autoFocus
            className="field-input wide"
            value={value}
            placeholder={dialog.input.placeholder}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && value.trim() && close(primary)}
          />
        )}
        <div className="dialog-actions">
          {dialog.buttons.map((b) => (
            <button
              key={b.id}
              type="button"
              className={cls('btn', b.kind)}
              autoFocus={!dialog.input && b.id === primary}
              disabled={!!dialog.input && b.id === primary && !value.trim()}
              onClick={() => close(b.id)}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export function ContextMenu(): ReactNode {
  const menu = menuSlot.use()
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })

  // Keep the menu inside the window.
  useLayoutEffect(() => {
    if (!menu || !ref.current) return
    const { width, height } = ref.current.getBoundingClientRect()
    setPos({
      x: Math.max(4, Math.min(menu.x, window.innerWidth - width - 4)),
      y: Math.max(4, Math.min(menu.y, window.innerHeight - height - 4))
    })
  }, [menu])

  useEffect(() => {
    if (!menu) return
    const close = (): void => menuSlot.set(null)
    const onDown = (e: MouseEvent): void => {
      if (!ref.current?.contains(e.target as Node)) close()
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', close)
    }
  }, [menu])

  if (!menu) return null
  const close = (): void => menuSlot.set(null)

  return (
    <div ref={ref} className="menu" role="menu" style={{ left: pos.x, top: pos.y }}>
      {menu.items.map((item, i) => (
        <MenuRow key={i} item={item} close={close} />
      ))}
    </div>
  )
}

function MenuRow({ item, close }: { item: MenuItem; close: () => void }): ReactNode {
  const dateRef = useRef<HTMLInputElement>(null)
  if (item.kind === 'separator') return <div className="menu-sep" />
  if (item.kind === 'date') {
    return (
      <div className="menu-date">
        <button type="button" className="menu-item" onClick={() => dateRef.current?.showPicker()}>
          {item.label}
        </button>
        <input
          ref={dateRef}
          type="date"
          tabIndex={-1}
          defaultValue={item.value}
          onChange={(e) => {
            if (!e.target.value) return
            item.onPick(e.target.value)
            close()
          }}
        />
      </div>
    )
  }
  return (
    <button
      type="button"
      role="menuitem"
      className={cls('menu-item', item.danger && 'danger')}
      onClick={() => {
        close()
        item.onSelect()
      }}
    >
      {item.label}
    </button>
  )
}
