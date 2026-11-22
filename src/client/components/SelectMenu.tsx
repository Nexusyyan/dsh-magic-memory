import React, { useEffect, useId, useRef, useState } from 'react'
import { CheckMiniIcon } from './ui-helpers.js'

export interface SelectOption {
  readonly value: string
  readonly label: string
  readonly sublabel?: string
  readonly group?: string
  readonly dotColor?: string
}

export interface SelectMenuProps {
  id?: string
  ariaLabel?: string
  value: string
  options: readonly SelectOption[]
  onChange: (value: string) => void
  compact?: boolean
  align?: 'left' | 'right'
  leadingIcon?: React.ReactNode
  placeholder?: string
  disabled?: boolean
}

function ChevronDownIcon({ open }: { open: boolean }): React.ReactElement {
  return (
    <svg
      width={13}
      height={13}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`dmm-dd-chevron${open ? ' dmm-dd-chevron-open' : ''}`}
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

export function SelectMenu({
  id,
  ariaLabel,
  value,
  options,
  onChange,
  compact = false,
  align = 'left',
  leadingIcon,
  placeholder = '',
  disabled = false,
}: SelectMenuProps): React.ReactElement {
  const [open, setOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const listboxId = useId()

  const selectedIndex = options.findIndex(o => o.value === value)
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : undefined

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [open])

  const toggleOpen = () => {
    if (disabled) return
    setOpen(prev => {
      const next = !prev
      if (next) {
        setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0)
      }
      return next
    })
  }

  const commit = (nextValue: string) => {
    onChange(nextValue)
    setOpen(false)
  }

  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) {
        setOpen(true)
        setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0)
        return
      }
      const delta = e.key === 'ArrowDown' ? 1 : -1
      setHighlightedIndex(idx => {
        if (options.length === 0) return -1
        const base = idx < 0 ? 0 : idx
        return (base + delta + options.length) % options.length
      })
    } else if (e.key === 'Enter' || e.key === ' ') {
      if (open && highlightedIndex >= 0 && options[highlightedIndex]) {
        e.preventDefault()
        commit(options[highlightedIndex]!.value)
      }
    }
  }

  // Group options preserving insertion order while supporting ungrouped items
  const renderedSections: Array<{ group?: string; items: Array<{ opt: SelectOption; flatIndex: number }> }> = []
  const groupBuckets = new Map<string, { group?: string; items: Array<{ opt: SelectOption; flatIndex: number }> }>()

  options.forEach((opt, flatIndex) => {
    const gKey = opt.group ?? '__ungrouped__'
    if (!opt.group) {
      renderedSections.push({ items: [{ opt, flatIndex }] })
      return
    }
    let bucket = groupBuckets.get(gKey)
    if (!bucket) {
      bucket = { group: opt.group, items: [] }
      groupBuckets.set(gKey, bucket)
      renderedSections.push(bucket)
    }
    bucket.items.push({ opt, flatIndex })
  })

  return (
    <div
      ref={rootRef}
      className={`dmm-dd${compact ? ' dmm-dd-compact' : ''}`}
      data-open={open}
    >
      <button
        id={id}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        disabled={disabled}
        className={`dmm-dd-trigger${compact ? ' dmm-dd-trigger-compact' : ''}`}
        onClick={toggleOpen}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="dmm-dd-value">
          {leadingIcon && <span className="dmm-dd-leading">{leadingIcon}</span>}
          {selectedOption?.dotColor && (
            <span className="dmm-dot" style={{ backgroundColor: selectedOption.dotColor }} aria-hidden="true" />
          )}
          <span className="dmm-dd-label">{selectedOption ? selectedOption.label : placeholder}</span>
        </span>
        <ChevronDownIcon open={open} />
      </button>

      {open && (
        <div
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel}
          className={`dmm-dd-menu${align === 'right' ? ' dmm-dd-menu-right' : ''}`}
        >
          {renderedSections.map((section, sIdx) => (
            <div key={section.group ?? `s-${sIdx}`} className="dmm-dd-section">
              {section.group && <div className="dmm-dd-group-label">{section.group}</div>}
              {section.items.map(({ opt, flatIndex }) => {
                const isSelected = opt.value === value
                const isHighlighted = flatIndex === highlightedIndex
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className="dmm-dd-item"
                    data-selected={isSelected}
                    data-highlighted={isHighlighted}
                    onMouseEnter={() => setHighlightedIndex(flatIndex)}
                    onClick={() => commit(opt.value)}
                  >
                    <span className="dmm-dd-item-main">
                      {opt.dotColor && (
                        <span className="dmm-dot" style={{ backgroundColor: opt.dotColor }} aria-hidden="true" />
                      )}
                      <span className="dmm-dd-item-text">
                        <span className="dmm-dd-item-label">{opt.label}</span>
                        {opt.sublabel && <span className="dmm-dd-item-sub">{opt.sublabel}</span>}
                      </span>
                    </span>
                    {isSelected && (
                      <span className="dmm-dd-check">
                        <CheckMiniIcon size={13} />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
