// REPRO (Palette): Delete buttons in ProjectGalleryModal and ShowPresetModal
// must have accessible aria-labels describing what will be deleted and focus-visible styling.
import { createRoot } from 'react-dom/client'
import { act, createElement as h } from 'react'
import { vi, describe, it, expect, afterEach } from 'vitest'
import ProjectGalleryModal from '../components/ThumbnailEditor/ProjectGalleryModal'
import ShowPresetModal from '../components/ThumbnailEditor/ShowPresetModal'

vi.mock('../modules/thumbnail/thumbnailStorage', () => ({
  listStoredProjects: vi.fn().mockResolvedValue([
    {
      id: 'proj-1',
      name: 'My Podcast Thumbnail',
      updatedAt: 1700000000000,
    },
  ]),
  loadProjectFromStorage: vi.fn().mockResolvedValue(null),
  deleteStoredProject: vi.fn().mockResolvedValue(undefined),
  exportProjectToJSON: vi.fn().mockReturnValue('{}'),
  importProjectFromJSON: vi.fn().mockReturnValue({}),
}))

vi.mock('../modules/shows/showPreferences', () => ({
  loadShowPresetsPersistent: vi.fn().mockResolvedValue([
    {
      id: 'custom-show-1',
      name: 'Custom Show Style',
      speakerCount: 2,
      background: { color: '#000000' },
      text: { fontFamily: 'Impact', fillColor: '#ffffff' },
    },
  ]),
  saveShowPresetPersistent: vi.fn().mockResolvedValue(undefined),
  deleteShowPresetPersistent: vi.fn().mockResolvedValue(undefined),
  createShowPresetFromProject: vi.fn().mockReturnValue({}),
}))

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let container, root
afterEach(() => {
  if (root) {
    act(() => root.unmount())
    root = null
  }
  if (container) {
    container.remove()
    container = null
  }
})

describe('Modal delete button accessibility', () => {
  it('ProjectGalleryModal delete button has accessible label and focus-visible class', async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => {
      root.render(h(ProjectGalleryModal, { currentProjectId: null, onLoadProject: vi.fn(), onClose: vi.fn() }))
    })

    const deleteBtn = container.querySelector('button[title="Delete Project"]')
    expect(deleteBtn).toBeTruthy()
    expect(deleteBtn.getAttribute('aria-label')).toBe('Delete My Podcast Thumbnail')
    expect(deleteBtn.className).toContain('focus-visible:outline')
  })

  it('ShowPresetModal delete button has accessible label and focus-visible class', async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => {
      root.render(h(ShowPresetModal, { currentProject: {}, onApplyShow: vi.fn(), onClose: vi.fn() }))
    })

    const deleteBtn = container.querySelector('button[title="Delete Show Preset"]')
    expect(deleteBtn).toBeTruthy()
    expect(deleteBtn.getAttribute('aria-label')).toBe('Delete Custom Show Style')
    expect(deleteBtn.className).toContain('focus-visible:outline')
  })
})
