// REPRO: the layers panel had no delete affordance at all, and Backspace only
// worked on text/logo/element layers. Every layer that can be deleted gets a
// per-row delete button: extra texts, logos, elements, and speakers with a
// photo (clearing the photo, keeping the slot). Structural layers (headline,
// graphics, background) and empty speaker slots get none.
import { createRoot } from 'react-dom/client'
import { act, createElement as h } from 'react'
import { vi, describe, it, expect, afterEach } from 'vitest'
import LayersPanel from '../components/ThumbnailEditor/LayersPanel'
import {
  createDefaultProject,
  createTextLayer,
  addTextLayer,
} from '../modules/thumbnail/thumbnailState'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let container, root, props
afterEach(() => {
  act(() => root.unmount())
  container.remove()
  delete window.pywebview
})

function fullProject() {
  let p = createDefaultProject('T')
  p = addTextLayer(p, { ...createTextLayer(p, 'txt_a') })
  p = {
    ...p,
    speakers: p.speakers.map((s, i) => (i === 0 ? { ...s, sourceImageUrl: 'data:,photo' } : s)),
  }
  return p
}

async function setup(project = fullProject()) {
  props = {
    project,
    selectedLayer: null,
    onSelectLayer: vi.fn(),
    onReorderLayers: vi.fn(),
    onToggleVisibility: vi.fn(),
    onAddElement: vi.fn(),
    onAddText: vi.fn(),
    onAddBug: vi.fn(),
    onDeleteLayer: vi.fn(),
  }
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => root.render(h(LayersPanel, props)))
  return props
}

const deleteButtons = () =>
  [...container.querySelectorAll('button[aria-label^="Delete "]')]

const rowOf = (name) => {
  const label = [...container.querySelectorAll('span')].find((s) => s.textContent === name)
  return label?.closest('[role="option"]')
}

describe('LayersPanel delete affordance', () => {
  it('offers delete on an extra text, and clicking it deletes that layer', async () => {
    await setup()
    const button = rowOf('NEW TEXT')?.querySelector('button[aria-label^="Delete "]')
    expect(button).toBeTruthy()
    act(() => button.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(props.onDeleteLayer).toHaveBeenCalledWith('txt_a')
  })

  it('lets Enter and Space activate a focused row button instead of selecting the row', async () => {
    await setup()
    const button = rowOf('NEW TEXT')?.querySelector('button[aria-label^="Delete "]')
    expect(button).toBeTruthy()
    for (const key of ['Enter', ' ']) {
      props.onSelectLayer.mockClear()
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
      act(() => { button.dispatchEvent(event) })
      expect(props.onSelectLayer).not.toHaveBeenCalled()
      // Not cancelled, so the browser's own button activation (click) goes ahead.
      expect(event.defaultPrevented).toBe(false)
    }
  })

  it('still selects the row itself with Enter', async () => {
    await setup()
    const row = rowOf('NEW TEXT')
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    act(() => { row.dispatchEvent(event) })
    expect(props.onSelectLayer).toHaveBeenCalledWith('txt_a')
    expect(event.defaultPrevented).toBe(true)
  })

  it('offers delete on a speaker with a photo, but not on an empty slot', async () => {
    const project = fullProject()
    await setup(project)
    const [host, guest] = project.speakers
    const hostRow = [...container.querySelectorAll('[role="option"]')].find((r) =>
      r.textContent.includes('Host')
    )
    expect(hostRow.querySelector('button[aria-label^="Delete "]')).toBeTruthy()
    const guestRow = [...container.querySelectorAll('[role="option"]')].find(
      (r) => r.textContent.includes('Guest') && !r.textContent.includes('Host')
    )
    expect(guestRow.querySelector('button[aria-label^="Delete "]')).toBeNull()
    expect(host.id).not.toBe(guest.id)
  })

  it('offers no delete on the structural layers', async () => {
    await setup()
    for (const name of ['Headline Text', 'Graphics', 'Background']) {
      expect(rowOf(name)?.querySelector('button[aria-label^="Delete "]')).toBeNull()
    }
    expect(deleteButtons().length).toBe(2) // the extra text and the photo speaker
  })
})
