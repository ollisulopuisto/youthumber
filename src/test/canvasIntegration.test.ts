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
    const project = createDefaultProject()
    expect(project.layerOrder[0]).toBe('background')
    expect(project.layerOrder[1]).toBe('speaker1')
    expect(project.layerOrder[2]).toBe('speaker2')
    expect(project.layerOrder[3]).toBe('text')
  })

  it('allows user to customize layer stack while keeping state deterministic', () => {
    const project = createDefaultProject()
    // Put Speaker 2 behind Speaker 1
    const customized = reorderLayers(project, ['background', 'speaker2', 'speaker1', 'text'])
    expect(customized.layerOrder).toEqual(['background', 'speaker2', 'speaker1', 'text'])
  })
})
