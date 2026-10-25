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
  | 'nudge'
  | 'nudgeFar'
  | 'bringForward'
  | 'sendBackward'
  | 'deselect'
  | 'palette'
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

const ARROWS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']

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
  {
    id: 'nudge',
    label: 'Move selection 1 px',
    group: 'Selection',
    bindings: ARROWS.map((key) => ({ key })),
  },
  {
    id: 'nudgeFar',
    label: 'Move selection 10 px',
    group: 'Selection',
    bindings: ARROWS.map((key) => ({ shift: true, key })),
  },
  { id: 'bringForward', label: 'Bring forward', group: 'Selection', bindings: [{ mod: true, key: ']' }] },
  { id: 'sendBackward', label: 'Send backward', group: 'Selection', bindings: [{ mod: true, key: '[' }] },
  { id: 'deselect', label: 'Deselect', group: 'Selection', bindings: [{ key: 'Escape' }] },
  {
    id: 'palette',
    label: 'Find a command',
    group: 'Help',
    bindings: [{ mod: true, key: 'k' }],
    inInputs: true,
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

/** Fields the arrow keys already move: text fields, and sliders and radio buttons too. */
function takesArrowKeys(target: EventTarget | null): boolean {
  return isTypingTarget(target) || (target as HTMLElement | null)?.tagName === 'INPUT'
}

/** How far a nudge shortcut moves the selection, in canvas px: Shift moves 10. */
export function nudgeOffset(key: string, far: boolean): { dx: number; dy: number } | null {
  const step = far ? 10 : 1
  if (key === 'ArrowLeft') return { dx: -step, dy: 0 }
  if (key === 'ArrowRight') return { dx: step, dy: 0 }
  if (key === 'ArrowUp') return { dx: 0, dy: -step }
  if (key === 'ArrowDown') return { dx: 0, dy: step }
  return null
}

type KeyEventLike = Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'target'>

// Many layouts type these with Option/AltGr (on a Finnish Mac, ] is ⌥9), so Alt is allowed.
const ALT_TYPED_KEYS = new Set(['[', ']'])

function matches(binding: KeyBinding, event: KeyEventLike): boolean {
  const mod = event.metaKey || event.ctrlKey
  if (Boolean(binding.mod) !== mod) return false
  if (ALT_TYPED_KEYS.has(binding.key)) return event.key === binding.key
  if (event.altKey) return false
  // '?' already implies Shift, and keyboard layouts disagree on which key makes it.
  if (binding.key === '?') return event.key === '?'
  if (Boolean(binding.shift) !== event.shiftKey) return false
  return event.key.length === 1 ? event.key.toLowerCase() === binding.key : event.key === binding.key
}

/** The shortcut `event` triggers, or null. */
export function matchShortcut(event: KeyEventLike): ShortcutId | null {
  const typing = isTypingTarget(event.target)
  const arrowsTaken = event.key.startsWith('Arrow') && takesArrowKeys(event.target)
  for (const shortcut of SHORTCUTS) {
    if (typing && !shortcut.inInputs) continue
    if (arrowsTaken) continue
    if (shortcut.bindings.some((b) => matches(b, event))) return shortcut.id
  }
  return null
}

const KEY_NAMES: Record<string, { mac: string; other: string; aria: string }> = {
  Delete: { mac: '⌦', other: 'Del', aria: 'Delete' },
  Backspace: { mac: '⌫', other: 'Backspace', aria: 'Backspace' },
  Escape: { mac: 'Esc', other: 'Esc', aria: 'Escape' },
  ArrowLeft: { mac: '←', other: '←', aria: 'ArrowLeft' },
  ArrowRight: { mac: '→', other: '→', aria: 'ArrowRight' },
  ArrowUp: { mac: '↑', other: '↑', aria: 'ArrowUp' },
  ArrowDown: { mac: '↓', other: '↓', aria: 'ArrowDown' },
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
