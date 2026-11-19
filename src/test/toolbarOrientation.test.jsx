// The orientation toggle is manual: a toolbar button that flips the canvas
// between 16:9 and 9:16 (and back), labeled with the ratio it switches to.
import { act, createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import Toolbar from '../components/ThumbnailEditor/Toolbar'
import { createDefaultProject, switchProjectToPortrait } from '../modules/thumbnail/thumbnailState'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let root
let node

afterEach(() => {
  act(() => root?.unmount())
  node?.remove()
})

function renderToolbar(project, onToggleOrientation = vi.fn()) {
  node = document.createElement('div')
  document.body.append(node)
  root = createRoot(node)
  act(() =>
    root.render(
      h(Toolbar, {
        project,
        onUpdateProjectName: () => {},
        onSelectLayout: () => {},
        onApplyShowPreset: () => {},
        onOpenShows: () => {},
        onSaveProject: () => {},
        onUndo: () => {},
        onRedo: () => {},
        canUndo: false,
        canRedo: false,
        historyHead: 'h0',
        historyTips: [{ id: 'h0', label: 'initial state' }],
        onGotoHistory: () => {},
        onOpenProjects: () => {},
        onImportVideo: () => {},
        onToggleOrientation,
        onExport: () => {},
        exportSettings: { format: 'jpeg', resolution: 'hd' },
        onChangeExportSettings: () => {},
        onOpenShortcuts: () => {},
        onOpenWhatsNew: () => {},
        onOpenPalette: () => {},
        onSetSpeakerCount: () => {},
      })
    )
  )
  return onToggleOrientation
}

function orientationButton() {
  return [...node.querySelectorAll('button')].find((b) => /^(9:16|16:9)$/.test(b.textContent))
}

it('offers 9:16 while landscape, and clicking asks for the flip', () => {
  const onToggle = renderToolbar(createDefaultProject('Test', 2))
  const button = orientationButton()
  expect(button).toBeDefined()
  expect(button.textContent).toBe('9:16')
  act(() => button.click())
  expect(onToggle).toHaveBeenCalled()
})

it('offers 16:9 while portrait', () => {
  renderToolbar(switchProjectToPortrait(createDefaultProject('Test', 2)))
  expect(orientationButton().textContent).toBe('16:9')
})

it('warns in the tooltip that positions reset to the layout preset', () => {
  renderToolbar(createDefaultProject('Test', 2))
  expect(orientationButton().title).toMatch(/reset/i)
})
