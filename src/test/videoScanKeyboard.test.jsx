// REPRO (Palette): VideoScanModal must support Escape key dismissal, backdrop click dismissal, and focus management.
import { createRoot } from 'react-dom/client'
import { act, createElement as h } from 'react'
import { vi, describe, it, expect, afterEach } from 'vitest'
import VideoScanModal from '../components/ThumbnailEditor/VideoScanModal'

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
  opener.textContent = '🎬 Video'
  document.body.appendChild(opener)
  opener.focus()

  const props = {
    project: { speakers: [{ id: 'speaker-1', name: 'Alice' }] },
    targetSpeakerId: 'speaker-1',
    scan: null,
    onScanComplete: vi.fn(),
    onAssign: vi.fn(),
    onClose: vi.fn(),
  }
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => root.render(h(VideoScanModal, props)))
  const closeBtn = container.querySelector('button[aria-label="Close"]')
  return { props, opener, closeBtn, container }
}

describe('VideoScanModal keyboard accessibility', () => {
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

  it('does not dismiss when clicking inside the modal content', async () => {
    const { props, container } = await setup()
    const innerModal = container.querySelector('[role="dialog"] > div')
    expect(innerModal).toBeTruthy()
    act(() => {
      innerModal.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(props.onClose).not.toHaveBeenCalled()
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
