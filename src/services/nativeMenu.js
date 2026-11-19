/**
 * The macOS menu bar, drawn natively by the desktop app. The spec mirrors SHORTCUTS:
 * choosing a native item runs the same command the toolbar buttons and keyboard
 * shortcuts use, through the __youthumberNativeRun bridge the App component registers.
 * Cut/Copy/Paste/Select All carry the edit.* ids the Python side swaps for pywebview's
 * real clipboard items (a text field needs those); the Window items are OS actions
 * AppKit resolves itself. In a plain browser tab there is no pywebview and no bar.
 */
import { getShortcut } from '../modules/shortcuts/shortcuts'
import { commandForId } from '../modules/commands/commands'

/** A binding as it appears in a menu: ⌘S, ⇧⌘Z. Display only; the page owns the keys. */
function keyHint(binding) {
  if (!binding) return ''
  const mod = binding.mod ? '⌘' : ''
  const shift = binding.shift ? '⇧' : ''
  const key = binding.key.length === 1 ? binding.key.toUpperCase() : binding.key
  return `${shift}${mod}${key}`
}

function commandItem(shortcutId, label) {
  const shortcut = getShortcut(shortcutId)
  return {
    kind: 'item',
    id: shortcutId,
    label: label || shortcut.label,
    keys: keyHint(shortcut.bindings[0]),
    enabled: true,
  }
}

function clipboardItem(id, label, keys) {
  return { kind: 'item', id, label, keys, enabled: true }
}

/** A command with no keyboard shortcut: the menu is where it can be found. */
function commandOnlyItem(id) {
  return { kind: 'item', id, label: commandForId(id)?.label ?? id, keys: '', enabled: true }
}

/**
 * The menu spec sent to the desktop app. Every command appears exactly once,
 * with the same key hint the tooltips show; selection commands are always
 * enabled and no-op when nothing is selected, like pressing the key without
 * a selection. The nudge commands are left out on purpose: an arrow key
 * carries a direction, a menu item cannot. Item ids are the command ids the
 * App runs through __youthumberNativeRun (ShortcutId where one exists).
 */
export function buildNativeMenuSpec() {
  return [
    {
      id: 'file',
      label: 'File',
      items: [
        commandItem('newProject'),
        commandItem('projects'),
        commandOnlyItem('importVideo'),
        commandItem('save'),
        commandItem('export'),
        { kind: 'separator' },
        // AppKit runs window.* items itself and shows the real key (⌘W here).
        { kind: 'item', id: 'window.close', label: 'Close Window', keys: '', enabled: true },
      ],
    },
    {
      id: 'edit',
      label: 'Edit',
      items: [
        commandItem('undo'),
        commandItem('redo'),
        { kind: 'separator' },
        clipboardItem('edit.cut', 'Cut', '⌘X'),
        clipboardItem('edit.copy', 'Copy', '⌘C'),
        clipboardItem('edit.paste', 'Paste', '⌘V'),
        clipboardItem('edit.select_all', 'Select All', '⌘A'),
        { kind: 'separator' },
        commandItem('duplicate'),
        commandItem('delete'),
        commandItem('deselect'),
      ],
    },
    {
      id: 'object',
      label: 'Object',
      items: [
        commandOnlyItem('addText'),
        commandOnlyItem('addElement'),
        { kind: 'separator' },
        commandOnlyItem('editText'),
        commandOnlyItem('autoFrame'),
        commandOnlyItem('removeBackground'),
        commandOnlyItem('fitToHeadline'),
        { kind: 'separator' },
        commandOnlyItem('flip'),
        commandOnlyItem('resetPosition'),
        commandOnlyItem('resetMask'),
        { kind: 'separator' },
        commandOnlyItem('properties'),
      ],
    },
    {
      id: 'arrange',
      label: 'Arrange',
      items: [
        commandItem('bringForward'),
        commandItem('sendBackward'),
        { kind: 'separator' },
        commandOnlyItem('behindText'),
        commandOnlyItem('inFrontOfText'),
      ],
    },
    {
      id: 'view',
      label: 'View',
      items: [commandItem('palette')],
    },
    {
      id: 'window',
      label: 'Window',
      items: [
        // AppKit runs these through the responder chain and shows its own keys.
        { kind: 'item', id: 'window.minimize', label: 'Minimize', keys: '', enabled: true },
      ],
    },
    {
      id: 'help',
      label: 'Help',
      items: [commandItem('help')],
    },
  ]
}

/**
 * Hands the spec to the desktop app. Returns true when native menus were drawn;
 * false in a browser tab or when the native side declined, so callers can keep
 * their in-page affordances.
 */
export async function installNativeMenus() {
  const setNativeMenu = typeof window !== 'undefined' ? window.pywebview?.api?.set_native_menu : null
  if (!setNativeMenu) return false
  return !!(await setNativeMenu(buildNativeMenuSpec()))
}

/**
 * Installs the menus once the pywebview API exists: right away when the page loaded
 * after injection, or on the pywebviewready event when the editor mounted first.
 * The per-call guard keeps a late event from installing twice, and the native side
 * is idempotent besides. Returns a cleanup that stops the waiting.
 */
export function installNativeMenusWhenReady() {
  if (typeof window === 'undefined') return () => {}
  let started = false
  const install = () => {
    if (started) return
    started = true
    void installNativeMenus()
  }
  if (window.pywebview?.api?.set_native_menu) {
    install()
    return () => {}
  }
  window.addEventListener('pywebviewready', install)
  return () => window.removeEventListener('pywebviewready', install)
}
