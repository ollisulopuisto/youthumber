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
  it('mirrors the shortcut registry: File, Edit, Window, Help', () => {
    const menus = spec()
    expect(menus.map((m) => m.label)).toEqual(['File', 'Edit', 'Window', 'Help'])

    expect(itemsOf(menus[0]).map((i) => i.id)).toEqual(['projects', 'save', 'export'])
    expect(Object.fromEntries(itemsOf(menus[0]).map((i) => [i.id, i.keys]))).toEqual({
      projects: '⌘O',
      save: '⌘S',
      export: '⌘E',
    })

    const edit = menus[1].items
    expect(edit[0]).toMatchObject({ id: 'undo', keys: '⌘Z' })
    expect(edit[1]).toMatchObject({ id: 'redo', keys: '⇧⌘Z' })
    expect(edit[2]).toEqual({ kind: 'separator' })
    // edit.* ids let the native side swap in pywebview's real clipboard items.
    expect(itemsOf(menus[1]).slice(2).map((i) => i.id)).toEqual([
      'edit.cut',
      'edit.copy',
      'edit.paste',
      'edit.select_all',
    ])

    // Window items are OS actions; AppKit shows the real keys, so no hint text.
    expect(menus[2].items).toEqual([
      { kind: 'item', id: 'window.minimize', label: 'Minimize', keys: '', enabled: true },
      { kind: 'item', id: 'window.close', label: 'Close Window', keys: '', enabled: true },
    ])

    expect(itemsOf(menus[3]).map((i) => i.id)).toEqual(['palette', 'help'])
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
