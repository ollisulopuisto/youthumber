import { describe, it, expect, vi, afterEach } from 'vitest'
import { buildNativeMenuSpec, installNativeMenus, installNativeMenusWhenReady } from '../services/nativeMenu'

interface SpecItem {
  kind: string
  id?: string
  label?: string
  keys?: string
  enabled?: boolean
}
interface SpecMenu {
  id: string
  label: string
  items: SpecItem[]
}
const spec = () => buildNativeMenuSpec() as SpecMenu[]
const itemsOf = (menu: SpecMenu) => menu.items.filter((i) => i.kind === 'item')

afterEach(() => {
  delete (window as unknown as { pywebview?: unknown }).pywebview
  vi.restoreAllMocks()
})

describe('buildNativeMenuSpec', () => {
  it('mirrors the shortcut registry: File, Edit, Object, Arrange, View, Window, Help', () => {
    const menus = spec()
    expect(menus.map((m) => m.label)).toEqual([
      'File',
      'Edit',
      'Object',
      'Arrange',
      'View',
      'Window',
      'Help',
    ])

    expect(itemsOf(menus[0]).map((i) => i.id)).toEqual([
      'newProject',
      'projects',
      'importVideo',
      'save',
      'export',
      'window.close',
    ])
    expect(Object.fromEntries(itemsOf(menus[0]).map((i) => [i.id, i.keys]))).toEqual({
      newProject: '⌘N',
      projects: '⌘O',
      importVideo: '',
      save: '⌘S',
      export: '⌘E',
      // AppKit runs window.* items through the responder chain and shows its own keys.
      'window.close': '',
    })

    const edit = itemsOf(menus[1]).map((i) => [i.id, i.keys])
    expect(edit).toEqual([
      ['undo', '⌘Z'],
      ['redo', '⇧⌘Z'],
      // edit.* ids let the native side swap in pywebview's real clipboard items.
      ['edit.cut', '⌘X'],
      ['edit.copy', '⌘C'],
      ['edit.paste', '⌘V'],
      ['edit.select_all', '⌘A'],
      ['duplicate', '⌘D'],
      ['delete', 'Delete'],
      ['deselect', 'Escape'],
    ])

    expect(itemsOf(menus[2]).map((i) => i.id)).toEqual([
      'addText',
      'addElement',
      'editText',
      'autoFrame',
      'removeBackground',
      'fitToHeadline',
      'flip',
      'resetPosition',
      'resetMask',
      'properties',
    ])
    expect(itemsOf(menus[3]).map((i) => [i.id, i.keys])).toEqual([
      ['bringForward', '⌘]'],
      ['sendBackward', '⌘['],
      ['behindText', ''],
      ['inFrontOfText', ''],
    ])
    expect(itemsOf(menus[4]).map((i) => i.id)).toEqual(['toggleOrientation', 'palette'])

    // Window items are OS actions; AppKit shows the real keys, so no hint text.
    expect(menus[5].items).toEqual([
      { kind: 'item', id: 'window.minimize', label: 'Minimize', keys: '', enabled: true },
    ])

    expect(itemsOf(menus[6]).map((i) => i.id)).toEqual(['help'])
  })

  it('exposes every command exactly once, with the registry key hint', async () => {
    const { COMMANDS } = await import('../modules/commands/commands')
    const { getShortcut } = await import('../modules/shortcuts/shortcuts')
    // Nudges are arrow-key actions: a menu item cannot choose a direction,
    // and running one without a key is a no-op by design.
    const menuable = COMMANDS.filter((c) => c.id !== 'nudge' && c.id !== 'nudgeFar')
    const items = spec().flatMap((m) => itemsOf(m))
    const ids = items.map((i) => i.id)
    for (const command of menuable) {
      expect(ids.filter((id) => id === command.id)).toHaveLength(1)
      const item = items.find((i) => i.id === command.id)
      expect(item?.label).toBe(
        command.shortcutId ? getShortcut(command.shortcutId).label : command.label
      )
      const expectedKeys = command.shortcutId
        ? getShortcut(command.shortcutId).bindings[0]
        : null
      if (expectedKeys) expect(item?.keys).not.toBe('')
    }
  })

  it('labels come from the shortcut registry, not a second copy', () => {
    const save = itemsOf(spec()[0]).find((i) => i.id === 'save')
    expect(save?.label).toBe('Save project')
  })
})

describe('installNativeMenus', () => {
  it('hands the spec to the desktop app and reports a drawn bar', async () => {
    const setNativeMenu = vi.fn().mockResolvedValue(true)
    ;(window as unknown as { pywebview: unknown }).pywebview = { api: { set_native_menu: setNativeMenu } }

    expect(await installNativeMenus()).toBe(true)
    expect(setNativeMenu).toHaveBeenCalledWith(buildNativeMenuSpec())
  })

  it('reports false in a plain browser tab', async () => {
    expect(await installNativeMenus()).toBe(false)
  })

  it('reports false when the native side declines (off macOS)', async () => {
    ;(window as unknown as { pywebview: unknown }).pywebview = {
      api: { set_native_menu: vi.fn().mockResolvedValue(false) },
    }
    expect(await installNativeMenus()).toBe(false)
  })
})

describe('installNativeMenusWhenReady', () => {
  it('installs at once when the pywebview API is already there', () => {
    const setNativeMenu = vi.fn().mockResolvedValue(true)
    ;(window as unknown as { pywebview: unknown }).pywebview = { api: { set_native_menu: setNativeMenu } }

    const cleanup = installNativeMenusWhenReady()

    expect(setNativeMenu).toHaveBeenCalledOnce()
    cleanup()
  })

  it('waits for pywebviewready when the bridge is injected after mount', () => {
    const cleanup = installNativeMenusWhenReady()
    const setNativeMenu = vi.fn().mockResolvedValue(true)
    ;(window as unknown as { pywebview: unknown }).pywebview = { api: { set_native_menu: setNativeMenu } }

    expect(setNativeMenu).not.toHaveBeenCalled()
    window.dispatchEvent(new Event('pywebviewready'))
    expect(setNativeMenu).toHaveBeenCalledOnce()
    cleanup()
  })

  it('does not install twice when both paths observe readiness', () => {
    const setNativeMenu = vi.fn().mockResolvedValue(true)
    ;(window as unknown as { pywebview: unknown }).pywebview = { api: { set_native_menu: setNativeMenu } }

    const cleanup = installNativeMenusWhenReady()
    window.dispatchEvent(new Event('pywebviewready'))

    expect(setNativeMenu).toHaveBeenCalledOnce()
    cleanup()
  })

  it('stops listening when cleaned up', () => {
    const cleanup = installNativeMenusWhenReady()
    cleanup()
    const setNativeMenu = vi.fn().mockResolvedValue(true)
    ;(window as unknown as { pywebview: unknown }).pywebview = { api: { set_native_menu: setNativeMenu } }
    window.dispatchEvent(new Event('pywebviewready'))

    expect(setNativeMenu).not.toHaveBeenCalled()
  })
})
