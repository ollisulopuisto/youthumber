import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ariaKeyShortcuts, shortcutTitle } from '../../modules/shortcuts/shortcuts'
import { placeBar } from '../../modules/thumbnail/floatingPosition'
import { ShortcutKeys } from './Kbd'

/**
 * A few commands for the selected canvas object, floating just above it (below it when
 * there's no room). `rect` is the object's box in window pixels, null to hide. Rendered
 * into <body> so the canvas frame's overflow doesn't clip it; it never takes focus itself.
 */
function SelectionActionBar({ rect, viewportRef, label, commands, isEnabled, onRun }) {
  const barRef = useRef(null)
  const [size, setSize] = useState(null)
  const [viewport, setViewport] = useState(null)

  // Measure when the buttons change; the bar's width depends on them.
  useLayoutEffect(() => {
    const box = viewportRef.current?.getBoundingClientRect()
    const next = {
      left: Math.max(0, box?.left ?? 0),
      top: Math.max(0, box?.top ?? 0),
      width: Math.min(window.innerWidth, box?.right ?? Infinity) - Math.max(0, box?.left ?? 0),
      height: Math.min(window.innerHeight, box?.bottom ?? Infinity) - Math.max(0, box?.top ?? 0),
    }
    setViewport((previous) => previous && Object.keys(next).every((key) => previous[key] === next[key]) ? previous : next)
    const el = barRef.current
    if (!el) return
    const { offsetWidth: width, offsetHeight: height } = el
    if (width !== size?.width || height !== size?.height) setSize({ width, height })
  }, [label, commands.length, size, rect, viewportRef])

  if (!rect || !commands.length) return null

  const at = size && viewport ? placeBar(rect, viewport, size) : null

  // Arrow keys move between the buttons, as in any toolbar.
  const handleKeyDown = (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const buttons = [...barRef.current.querySelectorAll('button:not(:disabled)')]
    const index = buttons.indexOf(document.activeElement)
    const step = e.key === 'ArrowRight' ? 1 : -1
    buttons[(index + step + buttons.length) % buttons.length]?.focus()
  }

  return createPortal(
    <div
      ref={barRef}
      role="toolbar"
      aria-label={`Actions for ${label}`}
      onKeyDown={handleKeyDown}
      data-placement={at?.placement}
      className="fixed z-40 flex items-center gap-0.5 p-1 rounded-lg bg-gray-900/95 border border-gray-700 shadow-xl text-[11px] text-gray-200"
      style={at ? { left: at.left, top: at.top } : { left: 0, top: 0, visibility: 'hidden' }}
    >
      {commands.map((command) => {
        const more = command.id === 'properties'
        const text = more ? 'More…' : command.label
        const enabled = isEnabled(command)
        return (
          <button
            key={command.id}
            type="button"
            onClick={() => onRun(command)}
            disabled={!enabled}
            title={command.shortcutId ? shortcutTitle(command.shortcutId, command.label) : more ? 'Show all properties' : command.label}
            aria-keyshortcuts={command.shortcutId ? ariaKeyShortcuts(command.shortcutId) : undefined}
            className={`group relative px-2 py-1 rounded whitespace-nowrap font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500 ${
              command.danger ? 'text-red-300 hover:bg-red-900/60' : more ? 'text-gray-400 hover:bg-gray-800 hover:text-white' : 'hover:bg-gray-800'
            } ${more ? 'border-l border-gray-700 rounded-l-none ml-0.5' : ''}`}
          >
            {text}
            {/* The key, on hover or keyboard focus only: always-on caps made the bar twice as busy. */}
            {command.shortcutId && (
              <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-1.5 hidden group-hover:flex group-focus-visible:flex gap-0.5 p-0.5 rounded bg-gray-950/90">
                <ShortcutKeys id={command.shortcutId} small />
              </span>
            )}
          </button>
        )
      })}
    </div>,
    document.body
  )
}

export default SelectionActionBar
