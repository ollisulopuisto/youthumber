import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it } from 'vitest'
import Toolbar from '../components/ThumbnailEditor/Toolbar'
import { createDefaultProject } from '../modules/thumbnail/thumbnailState'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let root
let node

afterEach(() => {
  act(() => root?.unmount())
  node?.remove()
})

function renderToolbar(saveStatus) {
  node = document.createElement('div')
  document.body.append(node)
  root = createRoot(node)
  const project = createDefaultProject('Test', 2)
  act(() =>
    root.render(
      <Toolbar
        project={project}
        onUpdateProjectName={() => {}}
        onSelectLayout={() => {}}
        onApplyShowPreset={() => {}}
        onOpenShows={() => {}}
        onSaveProject={() => {}}
        onUndo={() => {}}
        onRedo={() => {}}
        canUndo={false}
        canRedo={false}
        historyHead="h0"
        historyTips={[{ id: 'h0', label: 'initial state' }]}
        onGotoHistory={() => {}}
        onOpenProjects={() => {}}
        onExport={() => {}}
        exportSettings={{ format: 'jpeg', resolution: 'hd' }}
        onChangeExportSettings={() => {}}
        onOpenShortcuts={() => {}}
        onOpenWhatsNew={() => {}}
        onOpenPalette={() => {}}
        onSetSpeakerCount={() => {}}
        saveStatus={saveStatus}
      />
    )
  )
}

const saveButton = () => [...node.querySelectorAll('button')].find((b) => /sav/i.test(b.textContent))

it('confirms a save on the button and in a polite status region', () => {
  renderToolbar('saved')
  expect(saveButton().textContent).toMatch(/Saved/)
  expect(node.querySelector('[role="status"]').textContent).toMatch(/saved/i)
})

it('disables the save button while saving', () => {
  renderToolbar('saving')
  expect(saveButton().disabled).toBe(true)
  expect(saveButton().textContent).toMatch(/Saving/)
})

it('keeps the plain Save label when idle', () => {
  renderToolbar('idle')
  expect(saveButton().textContent.trim()).toBe('Save')
})
