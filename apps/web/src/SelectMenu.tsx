import { useEffect, useId, useRef, useState } from 'react'

export type SelectOption = {
  value: string
  label: string
}

type SelectMenuProps = {
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  disabled?: boolean
  tone?: 'dark' | 'light'
  className?: string
  'aria-label'?: string
}

export function SelectMenu({
  value,
  options,
  onChange,
  disabled = false,
  tone = 'light',
  className = '',
  'aria-label': ariaLabel,
}: SelectMenuProps) {
  const [open, setOpen] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const leaveTimer = useRef<number | null>(null)
  const openRef = useRef(false)
  const leavingRef = useRef(false)
  const listId = useId()
  const selected = options.find((o) => o.value === value) ?? options[0]

  openRef.current = open
  leavingRef.current = leaving

  function clearLeaveTimer() {
    if (leaveTimer.current != null) {
      window.clearTimeout(leaveTimer.current)
      leaveTimer.current = null
    }
  }

  function closeMenu() {
    if (!openRef.current || leavingRef.current) return
    setLeaving(true)
    clearLeaveTimer()
    leaveTimer.current = window.setTimeout(() => {
      setOpen(false)
      setLeaving(false)
      leaveTimer.current = null
    }, 140)
  }

  function openMenu() {
    clearLeaveTimer()
    setLeaving(false)
    setOpen(true)
  }

  function toggle() {
    if (disabled) return
    if (openRef.current && !leavingRef.current) closeMenu()
    else openMenu()
  }

  useEffect(() => () => clearLeaveTimer(), [])

  useEffect(() => {
    if (!open || leaving) return
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) closeMenu()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeMenu()
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, leaving])

  return (
    <div
      ref={rootRef}
      className={[
        'select-menu',
        `select-menu--${tone}`,
        open ? 'is-open' : '',
        leaving ? 'is-leaving' : '',
        disabled ? 'is-disabled' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <button
        type="button"
        className="select-menu__trigger"
        aria-haspopup="listbox"
        aria-expanded={open && !leaving}
        aria-controls={listId}
        aria-label={ariaLabel}
        disabled={disabled || options.length === 0}
        onClick={toggle}
      >
        <span className="select-menu__value">
          {selected?.label ?? (options.length ? value : '暂无选项')}
        </span>
        <span className="select-menu__chevron" aria-hidden="true" />
      </button>
      {open ? (
        <ul
          id={listId}
          className="select-menu__list"
          role="listbox"
          aria-activedescendant={
            selected ? `${listId}-${selected.value}` : undefined
          }
        >
          {options.map((opt) => {
            const active = opt.value === value
            return (
              <li key={opt.value} role="presentation">
                <button
                  type="button"
                  id={`${listId}-${opt.value}`}
                  role="option"
                  aria-selected={active}
                  className={
                    active
                      ? 'select-menu__option is-active'
                      : 'select-menu__option'
                  }
                  onClick={() => {
                    onChange(opt.value)
                    closeMenu()
                  }}
                >
                  {opt.label}
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
