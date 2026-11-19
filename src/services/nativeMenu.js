/**
 * The macOS menu bar, drawn natively by the desktop app. The spec mirrors SHORTCUTS:
 * choosing a native item runs the same command the toolbar buttons and keyboard
 * shortcuts use, through the __youthumberNativeRun bridge the App component registers.
 * Cut/Copy/Paste/Select All carry the edit.* ids the Python side swaps for pywebview's
 * real clipboard items (a text field needs those); the Window items are OS actions
 * AppKit resolves itself. In a plain browser tab there is no pywebview and no bar.
 */
import { getShortcut } from '../modules/shortcuts/shortcuts'

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

/** The menu spec sent to the desktop app. Item ids are ShortcutIds the App runs. */
export function buildNativeMenuSpec() {
  return [
    {
      id: 'file',
      label: 'File',
      items: [commandItem('projects'), commandItem('save'), commandItem('export')],
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
      ],
    },
    {
      id: 'window',
      label: 'Window',
      items: [
        // AppKit runs these through the responder chain and shows its own keys.
        { kind: 'item', id: 'window.minimize', label: 'Minimize', keys: '', enabled: true },
        { kind: 'item', id: 'window.close', label: 'Close Window', keys: '', enabled: true },
      ],
    },
    {
      id: 'help',
      label: 'Help',
      items: [commandItem('palette'), commandItem('help')],
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
