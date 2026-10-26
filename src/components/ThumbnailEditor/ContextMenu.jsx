import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ariaKeyShortcuts } from '../../modules/shortcuts/shortcuts'
import { commandsFor } from '../../modules/commands/commands'
import { placeMenu } from '../../modules/thumbnail/floatingPosition'
import { ShortcutKeys } from './Kbd'

/**
 * The right-click menu for a canvas object: the commands its selection bar and the palette
 * offer, as a list. `menu` is { layerId, x, y } in window pixels, null to close. It takes
 * focus when it opens and gives it back when it closes without running something.
 */
function ContextMenu({ menu, label, project, isEnabled, onRun, onClose }) {
  const menuRef = useRef(null)
  const [size, setSize] = useState(null)
  const commands = menu ? commandsFor(menu.layerId, project) : []

  // Measure when the items change; the width follows the longest label.
  useLayoutEffect(() => {
    const el = menuRef.current
    if (!el) return
    const { offsetWidth: width, offsetHeight: height } = el
    if (width !== size?.width || height !== size?.height) setSize({ width, height })
  }, [label, project, size])

  // Focus once it's measured and visible: a hidden first render can't take focus.
  useEffect(() => {
    if (menu && size) menuRef.current?.querySelector('[role="menuitem"]:not(:disabled)')?.focus()
  }, [menu, size])

  useEffect(() => {
    if (!menu) return
    const before = document.activeElement

    // Clicking anywhere else, scrolling or resizing closes it; a right-click elsewhere
    // closes it here and then opens the menu again for the new object.
    const closeOutside = (e) => {
      if (!menuRef.current?.contains(e.target)) onClose()
    }
    window.addEventListener('pointerdown', closeOutside, true)
    window.addEventListener('scroll', onClose, true)
    window.addEventListener('resize', onClose)
    return () => {
      window.removeEventListener('pointerdown', closeOutside, true)
      window.removeEventListener('scroll', onClose, true)
      window.removeEventListener('resize', onClose)
      // A command may have moved focus itself (Properties does); only restore it when nothing has.
      if (!document.activeElement || document.activeElement === document.body) before?.focus?.()
    }
  }, [menu, onClose])

  if (!menu || !commands.length) return null

  const viewport = { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight }
  const at = size ? placeMenu(menu, viewport, size) : null

  // Arrows, Home and End move between the enabled items; Esc and Tab close the menu.
  const handleKeyDown = (e) => {
    if (e.key === 'Escape' || e.key === 'Tab') {
      e.preventDefault()
      onClose()
      return
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return
    e.preventDefault()
    const items = [...menuRef.current.querySelectorAll('[role="menuitem"]:not(:disabled)')]
    const index = items.indexOf(document.activeElement)
    const last = items.length - 1
    const next = {
      ArrowDown: index >= last ? 0 : index + 1,
      ArrowUp: index <= 0 ? last : index - 1,
      Home: 0,
      End: last,
    }[e.key]
    items[next]?.focus()
  }

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label={`Actions for ${label}`}
      onKeyDown={handleKeyDown}
      onContextMenu={(e) => e.preventDefault()}
      className="fixed z-50 min-w-[180px] p-1 rounded-lg bg-gray-900/95 border border-gray-700 shadow-xl text-[12px] text-gray-200"
      style={at ? { left: at.left, top: at.top } : { left: 0, top: 0, visibility: 'hidden' }}
    >
      {commands.map((command) => {
        const enabled = isEnabled(command)
        return (
          <button
            key={command.id}
            type="button"
            role="menuitem"
            onClick={() => onRun(command)}
            disabled={!enabled}
            aria-keyshortcuts={command.shortcutId ? ariaKeyShortcuts(command.shortcutId) : undefined}
            className={`flex w-full items-center justify-between gap-6 px-2.5 py-1.5 rounded text-left whitespace-nowrap font-medium focus:outline-none focus:bg-gray-800 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent ${
              command.danger ? 'text-red-300 focus:bg-red-900/60 hover:bg-red-900/60' : ''
            }`}
          >
            <span>{command.label}</span>
            {command.shortcutId && (
              <span className="flex gap-0.5 text-gray-500">
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

export default ContextMenu
