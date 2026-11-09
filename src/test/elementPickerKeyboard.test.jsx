// REPRO (Palette): ElementPickerModal must support Escape key dismissal and focus management.
import { createRoot } from 'react-dom/client'
import { act, createElement as h } from 'react'
import { vi, describe, it, expect, afterEach } from 'vitest'
import ElementPickerModal from '../components/ThumbnailEditor/ElementPickerModal'

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
  opener.textContent = '+ Element'
  document.body.appendChild(opener)
  opener.focus()

  const props = {
    onPick: vi.fn(),
    onClose: vi.fn(),
  }
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => root.render(h(ElementPickerModal, props)))
  const closeBtn = container.querySelector('button[aria-label="Close"]')
  return { props, opener, closeBtn, container }
}

describe('ElementPickerModal keyboard accessibility', () => {
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

  it('renders element selection buttons with focus-visible styles', async () => {
    const { container } = await setup()
    const elementButtons = container.querySelectorAll('section button')
    expect(elementButtons.length).toBeGreaterThan(0)
    for (const btn of elementButtons) {
      expect(btn.className).toContain('focus-visible:outline')
      expect(btn.className).toContain('focus-visible:outline-2')
      expect(btn.className).toContain('focus-visible:outline-amber-500')
    }
  })
})
