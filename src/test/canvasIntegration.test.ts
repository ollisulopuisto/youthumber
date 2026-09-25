import { describe, it, expect } from 'vitest'
import { CANVAS_WIDTH, CANVAS_HEIGHT, createDefaultProject, reorderLayers } from '../modules/thumbnail/thumbnailState'

describe('Canvas 1280x720 & Layer Model Integration', () => {
  it('enforces fixed 1280x720 canvas dimensions', () => {
    expect(CANVAS_WIDTH).toBe(1280)
    expect(CANVAS_HEIGHT).toBe(720)
    const aspectRatio = CANVAS_WIDTH / CANVAS_HEIGHT
    expect(aspectRatio).toBeCloseTo(16 / 9, 2)
  })

  it('maintains Text above speakers and speakers above background by default', () => {
    const project = createDefaultProject('P', 4)
    expect(project.layerOrder).toEqual(['background', 'decor', ...project.speakers.map((s) => s.id), 'text'])
  })

  it('allows user to customize layer stack while keeping state deterministic', () => {
    const project = createDefaultProject()
    const [a, b] = project.speakers.map((s) => s.id)
    const customized = reorderLayers(project, ['background', b, a, 'text'])
    expect(customized.layerOrder).toEqual(['background', b, a, 'text'])
  })
})
