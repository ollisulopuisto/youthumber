import { describe, it, expect } from 'vitest'
import { computeAutoFrameTransform } from '../modules/thumbnail/autoFrame'
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../modules/thumbnail/thumbnailState'

describe('computeAutoFrameTransform', () => {
  it('scales a person to fill the canvas height, independent of source resolution', () => {
    // A person occupying the vertical middle 60% of a 1920x1080 source image.
    const bbox = { width: 1920, height: 1080, nx1: 0.4, ny1: 0.2, nx2: 0.6, ny2: 0.8 }
    const transform = computeAutoFrameTransform(bbox, 'speaker1')

    expect(transform).not.toBeNull()
    const personHeightPx = (bbox.ny2 - bbox.ny1) * bbox.height
    const expectedScale = (CANVAS_HEIGHT * 1.05) / personHeightPx
    expect(transform!.scaleX).toBeCloseTo(expectedScale, 2)
    expect(transform!.scaleY).toBeCloseTo(expectedScale, 2)
  })

  it('places speaker1 left-of-center and speaker2 right-of-center for the same bbox', () => {
    const bbox = { width: 1000, height: 1000, nx1: 0.3, ny1: 0.1, nx2: 0.7, ny2: 0.9 }
    const left = computeAutoFrameTransform(bbox, 'speaker1')
    const right = computeAutoFrameTransform(bbox, 'speaker2')

    expect(left!.x).toBeLessThan(CANVAS_WIDTH / 2)
    expect(right!.x).toBeGreaterThan(CANVAS_WIDTH / 2)
  })

  it('returns null for a degenerate (zero-area) bounding box', () => {
    const bbox = { width: 1000, height: 1000, nx1: 0.5, ny1: 0.5, nx2: 0.5, ny2: 0.5 }
    expect(computeAutoFrameTransform(bbox, 'speaker1')).toBeNull()
  })
})
