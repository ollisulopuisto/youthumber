import { createRoot } from 'react-dom/client'
import { act, createElement as h } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { createDefaultProject } from '../modules/thumbnail/thumbnailState'
import { listStoredProjects, loadProjectFromStorage } from '../modules/thumbnail/thumbnailStorage'

const exportThumbnail = vi.hoisted(() => vi.fn().mockResolvedValue({}))
vi.mock('../modules/thumbnail/thumbnailStorage', () => ({
  listStoredProjects: vi.fn().mockResolvedValue([]),
  loadProjectFromStorage: vi.fn().mockResolvedValue(null),
  saveProjectToStorage: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../components/ThumbnailEditor/ThumbnailStudioCanvas', async () => {
  const { useImperativeHandle, createElement } = await import('react')
  return { default: function Canvas({ ref }) {
    useImperativeHandle(ref, () => ({ exportThumbnail }))
    return createElement('div', null, 'Canvas fixture')
  } }
})

globalThis.IS_REACT_ACT_ENVIRONMENT = true
let root, host
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ presets: [] }) }))
  listStoredProjects.mockResolvedValue([])
  loadProjectFromStorage.mockResolvedValue(null)
})
afterEach(() => { act(() => root?.unmount()); host?.remove(); vi.clearAllMocks(); vi.unstubAllGlobals() })
async function mount() {
  localStorage.setItem('whats-new-seen', '99.12.31.1')
  host = document.createElement('div'); document.body.append(host)
  root = createRoot(host)
  await act(async () => { root.render(h(App)) })
}

describe('workspace and export defaults', () => {
  it('lets Layers and Properties span the canvas and speaker rows on desktop', async () => {
    await mount()
    const properties = host.querySelector('[aria-label="Properties"]')
    const sidebar = properties.parentElement
    expect(sidebar.children).toHaveLength(2) // Layers and Properties remain separate cards.
    expect(sidebar.className).toContain('xl:row-span-2')
    expect(sidebar.className).toContain('xl:col-start-2')
    expect(sidebar.className).toContain('xl:row-start-1')
    expect(sidebar.className).toContain('xl:overflow-y-auto')
    expect(sidebar.parentElement.className).toContain('xl:grid-rows-[minmax(0,1fr)_auto]')
    const speakers = sidebar.parentElement.lastElementChild
    expect(speakers.className).toContain('xl:max-h-[40vh]')
    expect(speakers.className).toContain('xl:min-h-0')
    expect(speakers.className).toContain('xl:overflow-y-auto')
  })

  it('exports 1080p initially and honors later 720p choices', async () => {
    await mount()
    const resolution = host.querySelector('select[title="Export resolution"]')
    expect(resolution.value).toBe('fullhd')
    const exportButton = () => [...host.querySelectorAll('button')].find(b => b.textContent.startsWith('Export '))
    expect(exportButton().textContent).toContain('1920×1080')
    await act(async () => exportButton().click())
    expect(exportThumbnail).toHaveBeenLastCalledWith(expect.objectContaining({ scale: 1.5, filename: expect.stringContaining('1920x1080') }))
    await act(async () => { resolution.value = 'hd'; resolution.dispatchEvent(new Event('change', { bubbles: true })) })
    expect(exportButton().textContent).toContain('1280×720')
    const headline = host.querySelector('textarea')
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(headline, 'Edited'); headline.dispatchEvent(new Event('input', { bubbles: true })) })
    expect(headline.value).toBe('Edited')
    expect(resolution.value).toBe('hd')
    await act(async () => exportButton().click())
    expect(exportThumbnail).toHaveBeenLastCalledWith(expect.objectContaining({ scale: 1, filename: expect.stringContaining('1280x720') }))
  })
  it('keeps a restored portrait canvas and uses its 1080p dimensions', async () => {
    const restored = createDefaultProject('Saved portrait')
    restored.canvas = { ...restored.canvas, width: 720, height: 1280 }
    listStoredProjects.mockResolvedValue([{ id: restored.id }])
    loadProjectFromStorage.mockResolvedValue(restored)
    await mount()
    const button = [...host.querySelectorAll('button')].find(b => b.textContent.startsWith('Export '))
    expect(button.textContent).toContain('1080×1920')
    await act(async () => button.click())
    expect(exportThumbnail).toHaveBeenLastCalledWith(expect.objectContaining({ scale: 1.5, filename: expect.stringContaining('1080x1920') }))
    expect(loadProjectFromStorage).toHaveBeenCalledWith(restored.id)
  })

})
