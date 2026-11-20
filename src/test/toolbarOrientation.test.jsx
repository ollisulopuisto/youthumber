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

const orientationButton = (label) =>
  [...node.querySelectorAll('[role="group"][aria-label="Orientation"] button')].find((b) => b.textContent === label)

it('marks 16:9 as current while landscape, and clicking 9:16 asks for the flip', () => {
  const onToggle = renderToolbar(createDefaultProject('Test', 2))
  expect(orientationButton('16:9').getAttribute('aria-pressed')).toBe('true')
  expect(orientationButton('9:16').getAttribute('aria-pressed')).toBe('false')
  act(() => orientationButton('16:9').click())
  expect(onToggle).not.toHaveBeenCalled()
  act(() => orientationButton('9:16').click())
  expect(onToggle).toHaveBeenCalledTimes(1)
})

it('marks 9:16 as current while portrait, and clicking 16:9 asks for the flip', () => {
  const onToggle = renderToolbar(switchProjectToPortrait(createDefaultProject('Test', 2)))
  expect(orientationButton('9:16').getAttribute('aria-pressed')).toBe('true')
  act(() => orientationButton('9:16').click())
  expect(onToggle).not.toHaveBeenCalled()
  act(() => orientationButton('16:9').click())
  expect(onToggle).toHaveBeenCalledTimes(1)
})

it('warns in the tooltip that positions reset to the layout preset', () => {
  renderToolbar(createDefaultProject('Test', 2))
  expect(orientationButton('9:16').title).toMatch(/reset/i)
})
