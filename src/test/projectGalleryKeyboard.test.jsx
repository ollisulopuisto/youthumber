// REPRO (Palette): ProjectGalleryModal must support Escape key dismissal and focus management.
import { createRoot } from 'react-dom/client'
import { act, createElement as h } from 'react'
import { vi, describe, it, expect, afterEach } from 'vitest'
import ProjectGalleryModal from '../components/ThumbnailEditor/ProjectGalleryModal'

vi.mock('../modules/thumbnail/thumbnailStorage', () => ({
  listStoredProjects: vi.fn().mockResolvedValue([]),
  loadProjectFromStorage: vi.fn().mockResolvedValue(null),
  deleteStoredProject: vi.fn().mockResolvedValue(undefined),
  exportProjectToJSON: vi.fn().mockReturnValue('{}'),
  importProjectFromJSON: vi.fn().mockReturnValue({}),
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

async function setup() {
  const opener = document.createElement('button')
  opener.textContent = 'Projects'
  document.body.appendChild(opener)
  opener.focus()

  const props = {
    currentProjectId: 'test-1',
    onLoadProject: vi.fn(),
    onClose: vi.fn(),
  }
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => root.render(h(ProjectGalleryModal, props)))
  const closeBtn = container.querySelector('button[aria-label="Close"]')
  return { props, opener, closeBtn, container }
}

describe('ProjectGalleryModal keyboard accessibility', () => {
  it('focuses the close button upon opening', async () => {
    const { closeBtn } = await setup()
    expect(closeBtn).toBeTruthy()
    expect(document.activeElement).toBe(closeBtn)
  })

  it('dismisses via Escape key', async () => {
    const { props } = await setup()
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(props.onClose).toHaveBeenCalled()
  })

  it('restores focus to opener upon closing/unmounting', async () => {
    const { opener } = await setup()
    act(() => {
      root.unmount()
      root = null
    })
    expect(document.activeElement).toBe(opener)
    opener.remove()
  })
})
