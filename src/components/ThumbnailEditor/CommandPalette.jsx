import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ariaKeyShortcuts } from '../../modules/shortcuts/shortcuts'
import { nextEnabledIndex, paletteCommands, searchCommands } from '../../modules/commands/commands'
import { ShortcutKeys } from './Kbd'

/**
 * Every command the editor has, found by typing part of its name. Opens with ⌘K or the
 * toolbar's button; Enter runs the highlighted command, Esc closes.
 */
function CommandPalette({ layerId, project, isEnabled, onRun, onClose }) {
  const inputRef = useRef(null)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const results = useMemo(
    () => searchCommands(paletteCommands(layerId, project), query),
    [layerId, project, query]
  )
  const highlighted = Math.min(active, Math.max(0, results.length - 1))

  useEffect(() => {
    // Hand focus back to whatever opened the palette, unless a command has taken it.
    const opener = document.activeElement
    inputRef.current?.focus()
    return () => {
      if (!document.activeElement || document.activeElement === document.body) {
        if (opener instanceof HTMLElement) opener.focus()
      }
    }
  }, [])

  // Keep the highlighted row in view when the arrows move past the list's edge.
  useEffect(() => {
    document.getElementById(`palette-option-${highlighted}`)?.scrollIntoView({ block: 'nearest' })
  }, [highlighted])

  const run = (command) => {
    if (isEnabled(command)) onRun(command)
  }

  const handleKeyDown = (e) => {
    // Escape and ⌘K close it; the page's keys stay quiet while it's open.
    if (e.key === 'Escape' || e.key === 'Tab' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) {
      e.preventDefault()
      onClose()
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setActive(nextEnabledIndex(results, highlighted, e.key === 'ArrowDown' ? 1 : -1, isEnabled))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (results[highlighted]) run(results[highlighted])
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center px-4 pt-[12vh]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Find a command"
        className="w-full max-w-md bg-gray-900 border border-gray-700 rounded-xl shadow-2xl flex flex-col max-h-[70vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-list"
          aria-autocomplete="list"
          aria-activedescendant={results[highlighted] ? `palette-option-${highlighted}` : undefined}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
          }}
          onKeyDown={handleKeyDown}
          placeholder="Type a command…"
          className="w-full px-4 py-3 bg-transparent border-b border-gray-800 text-sm text-gray-100 placeholder-gray-500 outline-none"
        />
        <ul id="palette-list" role="listbox" aria-label="Commands" className="overflow-y-auto p-1.5">
          {results.map((command, index) => {
            const enabled = isEnabled(command)
            const isActive = index === highlighted
            return (
              <li
                key={command.id}
                id={`palette-option-${index}`}
                role="option"
                aria-selected={isActive}
                aria-disabled={!enabled}
                aria-keyshortcuts={command.shortcutId ? ariaKeyShortcuts(command.shortcutId) : undefined}
                onMouseMove={() => setActive(index)}
                onClick={() => run(command)}
                className={`flex items-center justify-between gap-6 px-3 py-2 rounded-md text-xs cursor-pointer ${
                  isActive ? 'bg-gray-800 text-white' : 'text-gray-300'
                } ${!enabled ? 'opacity-40 cursor-not-allowed' : ''} ${command.danger ? 'text-red-300' : ''}`}
              >
                <span>{command.label}</span>
                {command.shortcutId && (
                  <span className="flex gap-0.5 text-gray-500 shrink-0">
                    <ShortcutKeys id={command.shortcutId} small />
                  </span>
                )}
              </li>
            )
          })}
          {results.length === 0 && <li className="px-3 py-6 text-center text-xs text-gray-500">No command matches “{query}”.</li>}
        </ul>
      </div>
    </div>,
    document.body
  )
}

export default CommandPalette
