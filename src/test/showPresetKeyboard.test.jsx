// REPRO (Palette): ShowPresetModal must support Escape key dismissal, backdrop click dismissal, and focus management.
import { createRoot } from 'react-dom/client'
import { act, createElement as h } from 'react'
import { vi, describe, it, expect, afterEach } from 'vitest'
import ShowPresetModal from '../components/ThumbnailEditor/ShowPresetModal'

vi.mock('../modules/shows/showPreferences', () => ({
  loadShowPresetsPersistent: vi.fn().mockResolvedValue([
    {
      id: 'test-preset',
      name: 'Test Show',
      speakerCount: 1,
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

async function setup() {
  const opener = document.createElement('button')
  opener.textContent = 'Manage Shows'
  document.body.appendChild(opener)
  opener.focus()

  const props = {
    currentProject: {},
    onApplyShow: vi.fn(),
    onClose: vi.fn(),
  }
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => root.render(h(ShowPresetModal, props)))
  const closeBtn = container.querySelector('button[aria-label="Close"]')
  return { props, opener, closeBtn, container }
}

describe('ShowPresetModal keyboard accessibility', () => {
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

  it('dismisses via backdrop click', async () => {
    const { props, container } = await setup()
    const backdrop = container.querySelector('[role="dialog"]')
    expect(backdrop).toBeTruthy()
    act(() => {
      backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }))
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
