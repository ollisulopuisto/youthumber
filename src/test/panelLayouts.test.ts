import { describe, it, expect } from 'vitest'
import { getLayout, getLayoutsForCount, getDefaultLayout } from '../modules/thumbnail/layouts'
import { applyLayout, createDefaultProject, panelFor, switchProjectToPortrait } from '../modules/thumbnail/thumbnailState'

const rectsOf = (id: string) => getLayout(id)!.slots.map((s) => s.panel!)

describe('portrait panel layouts (Autoraffkat 1080x1920 scaled by 2/3)', () => {
  it('stacked panels are two 720x640 halves that tile the canvas', () => {
    expect(rectsOf('portrait-stacked-panels')).toEqual([
      { x: 0, y: 0, width: 720, height: 640 },
      { x: 0, y: 640, width: 720, height: 640 },
    ])
  })

  it('wide-on-top is a 720x405 wide panel over an 875 high close-up panel', () => {
    expect(rectsOf('portrait-wide-top')).toEqual([
      { x: 0, y: 0, width: 720, height: 405 },
      { x: 0, y: 405, width: 720, height: 875 },
    ])
  })

  it('wide-on-bottom puts the wide panel at the bottom and the close-up on top', () => {
    expect(rectsOf('portrait-wide-bottom')).toEqual([
      { x: 0, y: 0, width: 720, height: 875 },
      { x: 0, y: 875, width: 720, height: 405 },
    ])
  })

  it('panels never overlap and cover the whole 720x1280 canvas', () => {
    for (const id of ['portrait-stacked-panels', 'portrait-wide-top', 'portrait-wide-bottom']) {
      const total = rectsOf(id).reduce((sum, r) => sum + r.width * r.height, 0)
      expect(total).toBe(720 * 1280)
    }
  })

  it('offers them in the two-speaker portrait list without changing the default', () => {
    const ids = getLayoutsForCount(2, true).map((l) => l.id)
    expect(ids).toEqual(expect.arrayContaining(['portrait-stacked-panels', 'portrait-wide-top', 'portrait-wide-bottom']))
    expect(getDefaultLayout(2, true).id).toBe('portrait-stacked-duo')
  })

  it('gives each speaker the panel of the applied layout, and none for plain layouts', () => {
    let project = switchProjectToPortrait(createDefaultProject('t', 2))
    const [a, b] = project.speakers.map((s) => s.id)
    expect(panelFor(project, a)).toBeUndefined()
    project = applyLayout(project, getLayout('portrait-wide-top')!)
    expect(panelFor(project, a)).toEqual({ x: 0, y: 0, width: 720, height: 405 })
    expect(panelFor(project, b)?.height).toBe(875)
    expect(panelFor(project, 'spk_missing')).toBeUndefined()
  })
})
