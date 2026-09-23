import { describe, it, expect } from 'vitest'
import { computeAutoFrameTransform } from '../modules/thumbnail/autoFrame'
import { CANVAS_HEIGHT } from '../modules/thumbnail/thumbnailState'
import { getDefaultLayout } from '../modules/thumbnail/layouts'

// A person centred in the source image, so the transform's x/y is the person's centre.
const CENTRED = { width: 1000, height: 1000, nx1: 0.3, ny1: 0.1, nx2: 0.7, ny2: 0.9 }

describe('computeAutoFrameTransform', () => {
  it('scales the person to the slot’s target height, independent of source resolution', () => {
    const bbox = { width: 1920, height: 1080, nx1: 0.4, ny1: 0.2, nx2: 0.6, ny2: 0.8 }
    const frame = { centerX: 400, centerY: 432, personHeight: CANVAS_HEIGHT * 1.05 }

    const transform = computeAutoFrameTransform(bbox, frame)

    const personHeightPx = (bbox.ny2 - bbox.ny1) * bbox.height
    expect(transform!.scaleX).toBeCloseTo(frame.personHeight / personHeightPx, 2)
    expect(transform!.scaleY).toBe(transform!.scaleX)
  })

  it('centres the person on the slot', () => {
    const transform = computeAutoFrameTransform(CENTRED, { centerX: 300, centerY: 400, personHeight: 600 })

    expect(transform).toMatchObject({ x: 300, y: 400 })
  })

  it('puts each speaker of a three-speaker layout in its third, centre one at the canvas centre', () => {
    const xs = getDefaultLayout(3).slots.map((slot) => computeAutoFrameTransform(CENTRED, slot.frame)!.x)

    expect(xs[1]).toBeCloseTo(640, 0)
    expect(xs[0]).toBeLessThan(xs[1])
    expect(xs[2]).toBeGreaterThan(xs[1])
  })

  it('keeps the original two-speaker targets at 27% / 73% of the width', () => {
    const [left, right] = getDefaultLayout(2).slots.map(
      (slot) => computeAutoFrameTransform(CENTRED, slot.frame)!.x
    )

    expect(left).toBe(Math.round(1280 * 0.27))
    expect(right).toBe(Math.round(1280 * 0.73))
  })

  it('returns null for a degenerate (zero-area) bounding box', () => {
    const bbox = { width: 1000, height: 1000, nx1: 0.5, ny1: 0.5, nx2: 0.5, ny2: 0.5 }
    expect(computeAutoFrameTransform(bbox, getDefaultLayout(1).slots[0].frame)).toBeNull()
  })
})
