// The header shows the controls of one step at a time (Setup, Faces, Edit, Export);
// Undo, Redo, Save and Export stay on the first row whatever the step.
import { act, createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import Toolbar from '../components/ThumbnailEditor/Toolbar'
import { createDefaultProject } from '../modules/thumbnail/thumbnailState'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let root
let node
afterEach(() => {
  act(() => root?.unmount())
  node?.remove()
})

function mount(extra = {}) {
  node = document.createElement('div')
  document.body.append(node)
  root = createRoot(node)
  const props = {
    project: createDefaultProject('T', 2),
    onUpdateProjectName: () => {},
    onSelectLayout: () => {},
    onApplyShowPreset: () => {},
    onOpenShows: () => {},
    onSaveProject: vi.fn(),
    onUndo: vi.fn(),
    onRedo: () => {},
    canUndo: true,
    canRedo: false,
    historyHead: 'h0',
    historyTips: [{ id: 'h0', label: 'initial state' }],
    onGotoHistory: () => {},
    onOpenProjects: vi.fn(),
    onImportVideo: vi.fn(),
    onToggleOrientation: () => {},
    onExport: vi.fn(),
    exportSettings: { format: 'jpeg', resolution: 'hd' },
    onChangeExportSettings: () => {},
    onOpenShortcuts: () => {},
    onOpenWhatsNew: () => {},
    onOpenPalette: vi.fn(),
    onSetSpeakerCount: () => {},
    ...extra,
  }
  act(() => root.render(h(Toolbar, props)))
  return props
}

const tab = (id) => node.querySelector(`#toolbar-tab-${id}`)
const byText = (text) => [...node.querySelectorAll('button')].find((b) => b.textContent.trim() === text)
const has = (selector) => !!node.querySelector(selector)

it('starts on Setup with its controls and none of the other steps', () => {
  mount()
  expect(tab('setup').getAttribute('aria-selected')).toBe('true')
  expect(has('[aria-label="Number of speakers"]')).toBe(true)
  expect(has('select[aria-label="Layout"]')).toBe(true)
  expect(byText('🎬 Import video')).toBeUndefined()
  expect(has('select[title="Export resolution"]')).toBe(false)
})

it('shows each step\'s own controls when its tab is chosen', () => {
  const props = mount()
  act(() => tab('faces').click())
  act(() => byText('🎬 Import video').click())
  expect(props.onImportVideo).toHaveBeenCalled()
  expect(has('select[aria-label="Layout"]')).toBe(false)

  act(() => tab('edit').click())
  act(() => byText('Projects').click())
  expect(props.onOpenProjects).toHaveBeenCalled()
  act(() => byText('Commands').click())
  expect(props.onOpenPalette).toHaveBeenCalled()
  expect(has('select[aria-label="Undo branches"]')).toBe(true)

  act(() => tab('export').click())
  expect(has('select[title="Export resolution"]')).toBe(true)
  expect(has('select[aria-label="Export format"]')).toBe(true)
})

it('keeps Undo, Save and Export on the first row on every step', () => {
  const props = mount()
  for (const id of ['setup', 'faces', 'edit', 'export']) {
    act(() => tab(id).click())
    expect(node.querySelector('[aria-label="Undo"]')).not.toBeNull()
    expect(byText('Save')).toBeDefined()
    expect([...node.querySelectorAll('button')].some((b) => b.textContent.startsWith('Export '))).toBe(true)
  }
  act(() => node.querySelector('[aria-label="Undo"]').click())
  expect(props.onUndo).toHaveBeenCalled()
  act(() => byText('Save').click())
  expect(props.onSaveProject).toHaveBeenCalled()
})

it('moves between tabs with the arrow keys', () => {
  mount()
  act(() => tab('setup').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })))
  expect(tab('faces').getAttribute('aria-selected')).toBe('true')
  act(() => tab('faces').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })))
  act(() => tab('setup').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })))
  expect(tab('export').getAttribute('aria-selected')).toBe('true')
})
