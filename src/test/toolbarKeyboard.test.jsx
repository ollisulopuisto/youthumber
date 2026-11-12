// REPRO (Palette): Toolbar buttons must have focus-visible styling for keyboard users.
import { createRoot } from 'react-dom/client'
import { act, createElement as h } from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import colors from 'tailwindcss/colors'
import Toolbar from '../components/ThumbnailEditor/Toolbar'
import { createDefaultProject } from '../modules/thumbnail/thumbnailState'


// Tailwind v4 palette colours are oklch(); convert to sRGB to compute WCAG contrast.
function toRgb(value) {
  if (value === '#fff') return [1, 1, 1]
  const m = value.match(/oklch\(([\d.]+)% ([\d.]+) ([\d.]+)\)/)
  const L = Number(m[1]) / 100
  const C = Number(m[2])
  const hue = (Number(m[3]) * Math.PI) / 180
  const a = C * Math.cos(hue)
  const b = C * Math.sin(hue)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const ss = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const lin = [
    4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * ss,
    -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * ss,
    -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * ss,
  ]
  return lin.map((v) => Math.min(1, Math.max(0, v)))
}
const luminance = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b
function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)]
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}
function tokenColor(token) {
  if (token === 'white') return toRgb('#fff')
  const [name, shade] = token.split('-')
  return toRgb(colors[name][shade])
}

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
      // amber-500 everywhere, except the speaker-count buttons: their selected fill is
      // amber-600, so they use white (see the contrast test below).
      expect(btn.className).toMatch(/focus-visible:outline-(amber-500|white)(\s|$)/)
    }
  })

  it('focus outlines are inset for buttons inside an overflow-hidden group, so they are not clipped', async () => {
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
    const clippedBy = (btn) => {
      for (let el = btn.parentElement; el && el !== container; el = el.parentElement) {
        if (el.className.split(/\s+/).includes('overflow-hidden')) return el
      }
      return null
    }
    const clipped = buttons.filter(clippedBy)
    expect(clipped.length).toBeGreaterThan(0) // the speaker-count group
    for (const btn of clipped) {
      expect(
        btn.className,
        `Button "${btn.textContent}" sits in an overflow-hidden group; its outline is clipped unless inset`
      ).toContain('focus-visible:-outline-offset-2')
    }
  })
  it('the speaker-count focus outline contrasts at least 3:1 with every fill it can sit on', async () => {
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
          speakerCount: 2,
          onSetSpeakerCount: () => {},
        })
      )
    })
    const group = container.querySelector('[aria-label="Number of speakers"]')
    const buttons = Array.from(group.querySelectorAll('button'))
    const selected = buttons.filter((b) => b.getAttribute('aria-pressed') === 'true')
    expect(selected.length).toBe(1)
    expect(buttons.length).toBeGreaterThan(1)
    for (const btn of buttons) {
      const outline = btn.className.match(/focus-visible:outline-((?:white)|(?:[a-z]+-\d+))(?:\s|$)/)
      const fill = btn.className.match(/(?:^|\s)bg-([a-z]+-\d+)(?:\s|$)/)
      expect(outline, `no outline colour on "${btn.textContent}"`).not.toBeNull()
      expect(fill, `no fill colour on "${btn.textContent}"`).not.toBeNull()
      const ratio = contrast(tokenColor(outline[1]), tokenColor(fill[1]))
      expect(
        ratio,
        `"${btn.textContent}" outline ${outline[1]} on ${fill[1]} is only ${ratio.toFixed(2)}:1`
      ).toBeGreaterThanOrEqual(3)
    }
  })
})
