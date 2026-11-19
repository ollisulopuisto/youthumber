import { describe, it, expect, vi, afterEach } from 'vitest'
import { buildNativeMenuSpec, installNativeMenus } from '../services/nativeMenu'

afterEach(() => {
  delete (window as unknown as { pywebview?: unknown }).pywebview
  vi.restoreAllMocks()
})

describe('buildNativeMenuSpec', () => {
  it('mirrors the shortcut registry: File, Edit, Window, Help', () => {
    const spec = buildNativeMenuSpec()
    expect(spec.map((m) => m.label)).toEqual(['File', 'Edit', 'Window', 'Help'])

    const fileIds = spec[0].items.map((i) => i.kind === 'item' && i.id)
    expect(fileIds).toEqual(['projects', 'save', 'export'])
    const keys = Object.fromEntries(
      spec[0].items.map((i) => i.kind === 'item' && [i.id, i.keys]),
    )
    expect(keys).toEqual({ projects: '⌘O', save: '⌘S', export: '⌘E' })

    const edit = spec[1].items
    expect(edit[0]).toMatchObject({ id: 'undo', keys: '⌘Z' })
    expect(edit[1]).toMatchObject({ id: 'redo', keys: '⇧⌘Z' })
    expect(edit[2]).toEqual({ kind: 'separator' })
    // edit.* ids let the native side swap in pywebview's real clipboard items.
    expect(edit.slice(3).map((i) => i.kind === 'item' && i.id)).toEqual([
      'edit.cut',
      'edit.copy',
      'edit.paste',
      'edit.select_all',
    ])

    // Window items are OS actions; AppKit shows the real keys, so no hint text.
    expect(spec[2].items).toEqual([
      { kind: 'item', id: 'window.minimize', label: 'Minimize', keys: '', enabled: true },
      { kind: 'item', id: 'window.close', label: 'Close Window', keys: '', enabled: true },
    ])

    expect(spec[3].items.map((i) => i.kind === 'item' && i.id)).toEqual(['palette', 'help'])
  })

  it('labels come from the shortcut registry, not a second copy', () => {
    const spec = buildNativeMenuSpec()
    const save = spec[0].items.find((i) => i.kind === 'item' && i.id === 'save')
    expect(save && save.kind === 'item' && save.label).toBe('Save project')
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
