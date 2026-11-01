// REPRO (Palette): LayersPanel layer rows must be keyboard-operable.
// Asserts the DESIRED behavior; fails on current code = bug reproduced.
// No testing-library in repo: react-dom/client + native events only.
import { createRoot } from 'react-dom/client'
import { act, createElement as h } from 'react'
import { vi, describe, it, expect, afterEach } from 'vitest'
import LayersPanel from '../components/ThumbnailEditor/LayersPanel'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const project = {
  speakers: [],
  layerOrder: ['background', 'text'],
  text: { visible: true },
  decor: { visible: true },
  stickers: [],
  textLayers: [],
  bugs: [],
}

let container, root
afterEach(() => act(() => root.unmount()))

async function setup() {
  const props = {
    project,
    selectedLayer: null,
    onSelectLayer: vi.fn(),
    onReorderLayers: vi.fn(),
    onToggleVisibility: vi.fn(),
    onAddElement: vi.fn(),
    onAddText: vi.fn(),
    onAddBug: vi.fn(),
  }
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => root.render(h(LayersPanel, props)))
  const label = [...container.querySelectorAll('span')].find((s) => s.textContent === 'Headline Text')
  const row = label.closest('[class*="cursor-pointer"]')
  return { props, row, container }
}

const key = (el, k) =>
  act(() => { el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })) })

describe('LayersPanel layer row keyboard operability', () => {
  it('row exposes an interactive role', async () => {
    const { row } = await setup()
    expect(row).toBeTruthy()
    expect(row.getAttribute('role')).toBeTruthy() // FAILS now: no role
  })
  it('row is in tab order', async () => {
    const { row } = await setup()
    expect(row.tabIndex).toBe(0) // FAILS now: div default -1
  })
  it('Enter/Space on the row selects the layer', async () => {
    const { props, row } = await setup()
    key(row, 'Enter')
    key(row, ' ')
    expect(props.onSelectLayer).toHaveBeenCalledWith('text') // FAILS now: no handler
  })
  it('control: real buttons in the same panel ARE operable', async () => {
    const { props, container } = await setup()
    const btn = [...container.querySelectorAll('button')].find((b) => b.textContent === '+ Text')
    act(() => { btn.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    expect(props.onAddText).toHaveBeenCalled() // PASSES now: harness sanity
  })
})
