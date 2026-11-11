// REPRO (Palette): FontPicker font options and weight buttons must have focus-visible styling for keyboard users.
import { createRoot } from 'react-dom/client'
import { act, createElement as h } from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import FontPicker from '../components/ThumbnailEditor/FontPicker'

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

describe('FontPicker keyboard accessibility', () => {
  it('font option buttons have focus-visible styling', async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root.render(h(FontPicker, {
      fontFamily: 'Montserrat',
      fontWeight: '700',
      onChange: () => {},
    })))

    const options = container.querySelectorAll('button[role="option"]')
    expect(options.length).toBeGreaterThan(0)
    for (const opt of options) {
      expect(opt.className).toContain('focus-visible:outline')
      expect(opt.className).toContain('focus-visible:outline-2')
      expect(opt.className).toContain('focus-visible:outline-amber-500')
    }
  })

  it('weight buttons have focus-visible styling', async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root.render(h(FontPicker, {
      fontFamily: 'Montserrat',
      fontWeight: '700',
      onChange: () => {},
    })))

    const weightGroup = container.querySelector('[role="group"][aria-label="Font weight"]')
    const weightButtons = weightGroup.querySelectorAll('button')
    expect(weightButtons.length).toBe(3)
    for (const btn of weightButtons) {
      expect(btn.className).toContain('focus-visible:outline')
      expect(btn.className).toContain('focus-visible:outline-2')
      expect(btn.className).toContain('focus-visible:outline-amber-500')
    }
  })
})
