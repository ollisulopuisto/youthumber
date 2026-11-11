// REPRO (Palette): Toolbar buttons must have focus-visible styling for keyboard users.
import { createRoot } from 'react-dom/client'
import { act, createElement as h } from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import Toolbar from '../components/ThumbnailEditor/Toolbar'
import { createDefaultProject } from '../modules/thumbnail/thumbnailState'

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
  vi.clearAllMocks()
})

describe('Toolbar keyboard accessibility', () => {
  it('all toolbar action buttons have focus-visible outline classes', async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    const project = createDefaultProject('Test project')

    await act(async () => {
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
          canUndo: true,
          canRedo: true,
          historyHead: 'root',
          historyTips: [{ id: 'root', label: 'Initial' }],
          onGotoHistory: () => {},
          onOpenProjects: () => {},
          onExport: () => {},
          exportSettings: { format: 'jpeg', resolution: 'hd' },
          onChangeExportSettings: () => {},
          onOpenShortcuts: () => {},
          onOpenWhatsNew: () => {},
          onOpenPalette: () => {},
          onSetSpeakerCount: () => {},
        })
      )
    })

    const buttons = Array.from(container.querySelectorAll('button'))
    expect(buttons.length).toBeGreaterThan(0)

    for (const btn of buttons) {
      expect(
        btn.className,
        `Button "${btn.textContent || btn.getAttribute('aria-label') || btn.title}" missing focus-visible outline`
      ).toContain('focus-visible:outline')
      expect(btn.className).toContain('focus-visible:outline-2')
      expect(btn.className).toContain('focus-visible:outline-amber-500')
    }
  })
})
