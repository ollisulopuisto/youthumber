// REPRO (Palette): WhatsNewModal must support Escape key dismissal and focus management.
import { createRoot } from 'react-dom/client'
import { act, createElement as h } from 'react'
import { vi, describe, it, expect, afterEach } from 'vitest'
import WhatsNewModal from '../components/ThumbnailEditor/WhatsNewModal'

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
  opener.textContent = "What's new"
  document.body.appendChild(opener)
  opener.focus()

  const props = {
    version: '26.11.0.0',
    entries: [
      {
        version: '26.11.0.0',
        date: '2026-11-06',
        items: ['**New feature.** Added exciting thumbnail options.'],
      },
    ],
    onClose: vi.fn(),
  }
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => root.render(h(WhatsNewModal, props)))
  const closeBtn = container.querySelector('button[aria-label="Close"]')
  return { props, opener, closeBtn, container }
}

describe('WhatsNewModal keyboard accessibility', () => {
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
