import { describe, it, expect } from 'vitest'
import {
  SHORTCUTS,
  SHORTCUT_GROUPS,
  matchShortcut,
  formatBinding,
  shortcutTitle,
  ariaKeyShortcuts,
  isMacPlatform,
  isTypingTarget,
  nudgeOffset,
} from '../modules/shortcuts/shortcuts'

const key = (k: string, mods: { meta?: boolean; ctrl?: boolean; shift?: boolean; alt?: boolean } = {}, target: EventTarget | null = document.body) => ({
  key: k,
  metaKey: !!mods.meta,
  ctrlKey: !!mods.ctrl,
  shiftKey: !!mods.shift,
  altKey: !!mods.alt,
  target,
})

const input = (type = 'text') => Object.assign(document.createElement('input'), { type })

describe('matchShortcut', () => {
  it('accepts ⌘ and Ctrl alike for the modifier shortcuts', () => {
    expect(matchShortcut(key('z', { meta: true }))).toBe('undo')
    expect(matchShortcut(key('z', { ctrl: true }))).toBe('undo')
    expect(matchShortcut(key('s', { meta: true }))).toBe('save')
    expect(matchShortcut(key('e', { ctrl: true }))).toBe('export')
    expect(matchShortcut(key('o', { meta: true }))).toBe('projects')
    expect(matchShortcut(key('d', { meta: true }))).toBe('duplicate')
  })

  it('tells redo from undo by Shift, and takes Ctrl+Y as redo too', () => {
    expect(matchShortcut(key('Z', { meta: true, shift: true }))).toBe('redo')
    expect(matchShortcut(key('y', { ctrl: true }))).toBe('redo')
  })

  it('ignores letters without a modifier, and anything with Alt', () => {
    expect(matchShortcut(key('z'))).toBeNull()
    expect(matchShortcut(key('z', { meta: true, alt: true }))).toBeNull()
    expect(matchShortcut(key('s', { meta: true, shift: true }))).toBeNull()
  })

  it('deletes with either Delete or Backspace, but not with a modifier', () => {
    expect(matchShortcut(key('Delete'))).toBe('delete')
    expect(matchShortcut(key('Backspace'))).toBe('delete')
    expect(matchShortcut(key('Backspace', { meta: true }))).toBeNull()
  })

  it('opens the help sheet with ?, however the layout makes it', () => {
    expect(matchShortcut(key('?', { shift: true }))).toBe('help')
    expect(matchShortcut(key('?'))).toBe('help')
  })

  it('leaves typing keys to text fields, but still saves and exports from them', () => {
    const field = input()
    expect(matchShortcut(key('Backspace', {}, field))).toBeNull()
    expect(matchShortcut(key('?', { shift: true }, field))).toBeNull()
    expect(matchShortcut(key('z', { meta: true }, field))).toBeNull()
    expect(matchShortcut(key('s', { meta: true }, field))).toBe('save')
    expect(matchShortcut(key('e', { ctrl: true }, field))).toBe('export')
  })

  it('still fires from sliders and colour swatches, which take no typing', () => {
    expect(matchShortcut(key('z', { meta: true }, input('range')))).toBe('undo')
    expect(matchShortcut(key('Delete', {}, input('color')))).toBe('delete')
  })
})

describe('selection keys', () => {
  it('moves with the arrows, 10 px with Shift', () => {
    expect(matchShortcut(key('ArrowLeft'))).toBe('nudge')
    expect(matchShortcut(key('ArrowDown', { shift: true }))).toBe('nudgeFar')
    expect(matchShortcut(key('ArrowUp', { meta: true }))).toBeNull()
    expect(nudgeOffset('ArrowRight', false)).toEqual({ dx: 1, dy: 0 })
    expect(nudgeOffset('ArrowUp', true)).toEqual({ dx: 0, dy: -10 })
    expect(nudgeOffset('Enter', false)).toBeNull()
  })

  it('leaves the arrows to sliders, radio buttons and text fields', () => {
    expect(matchShortcut(key('ArrowLeft', {}, input('range')))).toBeNull()
    expect(matchShortcut(key('ArrowLeft', {}, input('radio')))).toBeNull()
    expect(matchShortcut(key('ArrowLeft', { shift: true }, input()))).toBeNull()
    expect(matchShortcut(key('ArrowLeft', {}, document.createElement('button')))).toBe('nudge')
  })

  it('reorders with ⌘] and ⌘[, also where the layout types brackets with Alt', () => {
    expect(matchShortcut(key(']', { meta: true }))).toBe('bringForward')
    expect(matchShortcut(key('[', { ctrl: true }))).toBe('sendBackward')
    expect(matchShortcut(key(']', { meta: true, alt: true }))).toBe('bringForward')
    expect(matchShortcut(key(']'))).toBeNull()
  })

  it('deselects with Esc, but not from a text field', () => {
    expect(matchShortcut(key('Escape'))).toBe('deselect')
    expect(matchShortcut(key('Escape', {}, input()))).toBeNull()
  })

  it('opens the command palette with ⌘K, even from a text field', () => {
    expect(matchShortcut(key('k', { meta: true }))).toBe('palette')
    expect(matchShortcut(key('k', { ctrl: true }, input()))).toBe('palette')
  })
})

describe('isTypingTarget', () => {
  it('counts text inputs, textareas, selects and editable content', () => {
    expect(isTypingTarget(input())).toBe(true)
    expect(isTypingTarget(document.createElement('textarea'))).toBe(true)
    expect(isTypingTarget(document.createElement('select'))).toBe(true)
    expect(isTypingTarget(document.createElement('button'))).toBe(false)
    expect(isTypingTarget(null)).toBe(false)
  })
})

describe('labels', () => {
  it('uses Mac symbols on a Mac and spelled-out keys elsewhere', () => {
    const redo = SHORTCUTS.find((s) => s.id === 'redo')!.bindings[0]
    expect(formatBinding(redo, true)).toBe('⌘⇧Z')
    expect(formatBinding(redo, false)).toBe('Ctrl+Shift+Z')
    expect(formatBinding({ key: 'Delete' }, true)).toBe('⌦')
    expect(formatBinding({ shift: true, key: '?' }, false)).toBe('?')
    expect(formatBinding({ shift: true, key: 'ArrowLeft' }, true)).toBe('⇧←')
    expect(formatBinding({ mod: true, key: ']' }, false)).toBe('Ctrl+]')
    expect(formatBinding({ key: 'Escape' }, true)).toBe('Esc')
  })

  it('names the action and its first key in tooltips', () => {
    expect(shortcutTitle('undo', undefined, true)).toBe('Undo (⌘Z)')
    expect(shortcutTitle('save', 'Save to local storage', false)).toBe('Save to local storage (Ctrl+S)')
  })

  it('lists every binding in aria-keyshortcuts, with the platform modifier', () => {
    expect(ariaKeyShortcuts('redo', true)).toBe('Meta+Shift+Z Meta+Y')
    expect(ariaKeyShortcuts('redo', false)).toBe('Control+Shift+Z Control+Y')
    expect(ariaKeyShortcuts('delete', false)).toBe('Delete Backspace')
    expect(ariaKeyShortcuts('help', true)).toBe('Shift+?')
    expect(ariaKeyShortcuts('nudgeFar', false)).toBe('Shift+ArrowLeft Shift+ArrowRight Shift+ArrowUp Shift+ArrowDown')
    expect(ariaKeyShortcuts('bringForward', true)).toBe('Meta+]')
    expect(ariaKeyShortcuts('deselect', true)).toBe('Escape')
  })
})

describe('registry', () => {
  it('gives each key combination to one shortcut only, and every shortcut a listed group', () => {
    const seen = new Set<string>()
    for (const shortcut of SHORTCUTS) {
      expect(SHORTCUT_GROUPS).toContain(shortcut.group)
      for (const b of shortcut.bindings) {
        const combo = formatBinding(b, false)
        expect(seen.has(combo)).toBe(false)
        seen.add(combo)
      }
    }
  })
})

describe('isMacPlatform', () => {
  it('reads the platform, preferring userAgentData', () => {
    expect(isMacPlatform({ platform: 'MacIntel' })).toBe(true)
    expect(isMacPlatform({ platform: 'Win32' })).toBe(false)
    expect(isMacPlatform({ platform: 'MacIntel', userAgentData: { platform: 'Windows' } })).toBe(false)
    expect(isMacPlatform({})).toBe(false)
  })
})
