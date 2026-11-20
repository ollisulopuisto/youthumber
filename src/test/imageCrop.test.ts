import { describe, expect, it } from 'vitest'
import { cropOffset, cropSource, MIN_VISIBLE, normalizeCrop, setCropEdge, visibleShare } from '../modules/thumbnail/imageCrop'

describe('normalizeCrop', () => {
  it('is undefined when nothing is cut, so uncropped projects stay as they were', () => {
    expect(normalizeCrop(undefined)).toBeUndefined()
    expect(normalizeCrop({ left: 0, top: 0, right: 0, bottom: 0 })).toBeUndefined()
  })

  it('drops junk and clamps each edge', () => {
    expect(normalizeCrop({ left: -1, top: Number.NaN, right: 2, bottom: 0.2 })).toEqual({
      left: 0,
      top: 0,
      right: 1 - MIN_VISIBLE,
      bottom: 0.2,
    })
  })

  it('never lets two opposite edges hide the whole image', () => {
    const crop = normalizeCrop({ left: 0.6, right: 0.6, top: 0.5, bottom: 0.5 })!
    expect(visibleShare(crop).x).toBeCloseTo(MIN_VISIBLE)
    expect(visibleShare(crop).y).toBeCloseTo(MIN_VISIBLE)
    expect(crop.left).toBe(0.6)
  })
})

describe('setCropEdge', () => {
  it('sets one edge and keeps the others', () => {
    const crop = setCropEdge(setCropEdge(undefined, 'left', 0.2), 'top', 0.1)
    expect(crop).toEqual({ left: 0.2, top: 0.1, right: 0, bottom: 0 })
  })

  it('makes the opposite edge give way when the dragged edge needs its room', () => {
    const crop = setCropEdge({ left: 0, top: 0, right: 0.7, bottom: 0 }, 'left', 0.5)!
    expect(crop.left).toBe(0.5)
    expect(crop.right).toBeCloseTo(1 - MIN_VISIBLE - 0.5)
  })

  it('returns to undefined when every edge is back at zero', () => {
    expect(setCropEdge({ left: 0.2, top: 0, right: 0, bottom: 0 }, 'left', 0)).toBeUndefined()
  })
})

describe('cropSource', () => {
  it('is the whole image without a crop', () => {
    expect(cropSource(400, 200)).toEqual({ cropX: 0, cropY: 0, width: 400, height: 200 })
  })

  it('is the visible rectangle in source pixels', () => {
    expect(cropSource(400, 200, { left: 0.25, top: 0.5, right: 0.25, bottom: 0 })).toEqual({
      cropX: 100,
      cropY: 100,
      width: 200,
      height: 100,
    })
  })
})

describe('cropOffset', () => {
  const crop = { left: 0.5, top: 0, right: 0, bottom: 0 }

  it('is zero without a crop', () => {
    expect(cropOffset(400, 200, undefined, 1, 1, 30)).toEqual({ dx: 0, dy: 0 })
  })

  it('moves the visible centre toward the kept side, scaled', () => {
    // Left half cut: the visible half's centre is a quarter of the width right of the image centre.
    expect(cropOffset(400, 200, crop, 1, 1, 0)).toEqual({ dx: 100, dy: 0 })
    expect(cropOffset(400, 200, crop, 2, 2, 0).dx).toBe(200)
  })

  it('follows a flip: the cut left edge is drawn on the right', () => {
    expect(cropOffset(400, 200, crop, 1, 1, 0, true).dx).toBe(-100)
  })

  it('turns with the layer', () => {
    const turned = cropOffset(400, 200, crop, 1, 1, 90)
    expect(turned.dx).toBeCloseTo(0)
    expect(turned.dy).toBeCloseTo(100)
  })

  it('keeps the kept pixels on screen: a cropped layer drawn at anchor+offset covers the same spot', () => {
    // Uncropped 400 wide centred at x=500 spans 300..700; cropping the left half leaves 500..700,
    // whose centre is 600 = anchor 500 + offset 100.
    const { dx } = cropOffset(400, 200, crop, 1, 1, 0)
    expect(500 + dx).toBe(600)
  })
})
