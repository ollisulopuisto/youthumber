/**
 * Every keyboard shortcut in the editor. The key handler, the button tooltips, the
 * aria-keyshortcuts attributes and the shortcuts sheet all read this list, so what the UI
 * says a key does is always what it does.
 */

export type ShortcutId =
  | 'undo'
  | 'redo'
  | 'save'
  | 'export'
  | 'projects'
  | 'duplicate'
  | 'delete'
  | 'help'

export interface KeyBinding {
  /** ⌘ on a Mac, Ctrl elsewhere. Either is accepted on every platform. */
  mod?: boolean
  shift?: boolean
  /** `KeyboardEvent.key`, lower-case for letters. */
  key: string
}

export interface Shortcut {
  id: ShortcutId
  label: string
  group: 'Edit' | 'File' | 'Selection' | 'Help'
  /** The first binding is the one tooltips show. */
  bindings: KeyBinding[]
  /** Also fires while typing in a text field, where the browser has nothing better to do with it. */
  inInputs?: boolean
}

export const SHORTCUTS: Shortcut[] = [
  { id: 'undo', label: 'Undo', group: 'Edit', bindings: [{ mod: true, key: 'z' }] },
  {
    id: 'redo',
    label: 'Redo',
    group: 'Edit',
    bindings: [
      { mod: true, shift: true, key: 'z' },
      { mod: true, key: 'y' },
    ],
  },
  { id: 'save', label: 'Save project', group: 'File', bindings: [{ mod: true, key: 's' }], inInputs: true },
  { id: 'export', label: 'Export thumbnail', group: 'File', bindings: [{ mod: true, key: 'e' }], inInputs: true },
  { id: 'projects', label: 'Open projects', group: 'File', bindings: [{ mod: true, key: 'o' }], inInputs: true },
  {
    id: 'duplicate',
    label: 'Duplicate selected text, logo or element',
    group: 'Selection',
    bindings: [{ mod: true, key: 'd' }],
  },
  {
    id: 'delete',
    label: 'Delete selected text, logo or element',
    group: 'Selection',
    bindings: [{ key: 'Delete' }, { key: 'Backspace' }],
  },
  { id: 'help', label: 'Show keyboard shortcuts', group: 'Help', bindings: [{ shift: true, key: '?' }] },
]

export const SHORTCUT_GROUPS = ['File', 'Edit', 'Selection', 'Help'] as const

const byId = new Map(SHORTCUTS.map((s) => [s.id, s]))

export function getShortcut(id: ShortcutId): Shortcut {
  return byId.get(id)!
}

interface PlatformInfo {
  platform?: string
  userAgentData?: { platform?: string }
}

export function isMacPlatform(nav: PlatformInfo | undefined = globalThis.navigator as PlatformInfo | undefined): boolean {
  const platform = nav?.userAgentData?.platform || nav?.platform || ''
  return /mac|iphone|ipad/i.test(platform)
}

/** Text fields, where plain keys type and ⌘Z undoes typing rather than the project. */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  if (el.isContentEditable) return true
  if (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true
  if (el.tagName !== 'INPUT') return false
  // Sliders, checkboxes and colour swatches don't take typing.
  const type = (el as HTMLInputElement).type
  return !['range', 'checkbox', 'radio', 'color', 'button', 'submit', 'file'].includes(type)
}

type KeyEventLike = Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'target'>

function matches(binding: KeyBinding, event: KeyEventLike): boolean {
  const mod = event.metaKey || event.ctrlKey
  if (Boolean(binding.mod) !== mod || event.altKey) return false
  // '?' already implies Shift, and keyboard layouts disagree on which key makes it.
  if (binding.key === '?') return event.key === '?'
  if (Boolean(binding.shift) !== event.shiftKey) return false
  return event.key.length === 1 ? event.key.toLowerCase() === binding.key : event.key === binding.key
}

/** The shortcut `event` triggers, or null. */
export function matchShortcut(event: KeyEventLike): ShortcutId | null {
  const typing = isTypingTarget(event.target)
  for (const shortcut of SHORTCUTS) {
    if (typing && !shortcut.inInputs) continue
    if (shortcut.bindings.some((b) => matches(b, event))) return shortcut.id
  }
  return null
}

const KEY_NAMES: Record<string, { mac: string; other: string; aria: string }> = {
  Delete: { mac: '⌦', other: 'Del', aria: 'Delete' },
  Backspace: { mac: '⌫', other: 'Backspace', aria: 'Backspace' },
}

/** The keys of a binding as separate caps, e.g. ['⌘', '⇧', 'Z'] or ['Ctrl', 'Shift', 'Z']. */
export function bindingKeys(binding: KeyBinding, mac = isMacPlatform()): string[] {
  const named = KEY_NAMES[binding.key]
  const key = named ? (mac ? named.mac : named.other) : binding.key.toUpperCase()
  if (binding.key === '?') return [key]
  return [
    ...(binding.mod ? [mac ? '⌘' : 'Ctrl'] : []),
    ...(binding.shift ? [mac ? '⇧' : 'Shift'] : []),
    key,
  ]
}

/** A binding as one string: '⌘⇧Z' on a Mac, 'Ctrl+Shift+Z' elsewhere. */
export function formatBinding(binding: KeyBinding, mac = isMacPlatform()): string {
  return bindingKeys(binding, mac).join(mac ? '' : '+')
}

/** A tooltip naming the action and its first key, e.g. 'Undo (⌘Z)'. */
export function shortcutTitle(id: ShortcutId, label = getShortcut(id).label, mac = isMacPlatform()): string {
  return `${label} (${formatBinding(getShortcut(id).bindings[0], mac)})`
}

/** The aria-keyshortcuts value for a shortcut: every binding, space-separated. */
export function ariaKeyShortcuts(id: ShortcutId, mac = isMacPlatform()): string {
  return getShortcut(id)
    .bindings.map((b) => {
      if (b.key === '?') return 'Shift+?'
      const key = KEY_NAMES[b.key]?.aria ?? b.key.toUpperCase()
      return [...(b.mod ? [mac ? 'Meta' : 'Control'] : []), ...(b.shift ? ['Shift'] : []), key].join('+')
    })
    .join(' ')
}
