import { describe, it, expect } from 'vitest'
import { intersectRect, placeBar, placeMenu } from '../modules/thumbnail/floatingPosition'

const viewport = { left: 0, top: 50, width: 1000, height: 600 }
const bar = { width: 200, height: 30 }

describe('placeBar', () => {
  it('centres the bar above the object', () => {
    expect(placeBar({ left: 400, top: 300, width: 100, height: 100 }, viewport, bar)).toEqual({
      left: 350,
      top: 262,
      placement: 'above',
    })
  })

  it('goes below an object at the top of the view', () => {
    const at = placeBar({ left: 400, top: 60, width: 100, height: 100 }, viewport, bar)
    expect(at).toEqual({ left: 350, top: 168, placement: 'below' })
  })

  it('goes just inside an object that fills the view', () => {
    const at = placeBar({ left: -100, top: 0, width: 1200, height: 800 }, viewport, bar)
    expect(at).toEqual({ left: 400, top: 58, placement: 'inside' })
  })

  it('stays inside the left and right edges', () => {
    expect(placeBar({ left: 0, top: 300, width: 20, height: 20 }, viewport, bar)!.left).toBe(8)
    expect(placeBar({ left: 990, top: 300, width: 10, height: 10 }, viewport, bar)!.left).toBe(792)
  })

  it('anchors to the visible part of an object partly scrolled away', () => {
    // Only the bottom 40 px are in view, so there is no room above; it goes below.
    const at = placeBar({ left: 400, top: -50, width: 100, height: 140 }, viewport, bar)
    expect(at).toEqual({ left: 350, top: 98, placement: 'below' })
  })

  it('hides for an object out of view', () => {
    expect(placeBar({ left: 400, top: 700, width: 100, height: 100 }, viewport, bar)).toBeNull()
    expect(placeBar({ left: -300, top: 300, width: 100, height: 100 }, viewport, bar)).toBeNull()
  })

  it('pins a bar wider than the view to its left edge', () => {
    const at = placeBar({ left: 100, top: 300, width: 50, height: 50 }, { left: 0, top: 0, width: 150, height: 600 }, bar)
    expect(at!.left).toBe(8)
  })
})

describe('placeMenu', () => {
  const menu = { width: 180, height: 200 }

  it('opens down and right of the pointer', () => {
    expect(placeMenu({ x: 100, y: 100 }, viewport, menu)).toEqual({ left: 100, top: 100 })
  })

  it('flips left and up near the right and bottom edges', () => {
    expect(placeMenu({ x: 950, y: 600 }, viewport, menu)).toEqual({ left: 770, top: 400 })
  })

  it('stays inside a viewport smaller than the menu', () => {
    expect(placeMenu({ x: 10, y: 60 }, { left: 0, top: 50, width: 100, height: 100 }, menu)).toEqual({ left: 8, top: 58 })
  })
})

describe('intersectRect', () => {
  it('returns the overlap, or null', () => {
    expect(intersectRect({ left: 0, top: 0, width: 10, height: 10 }, { left: 5, top: 5, width: 10, height: 10 })).toEqual({
      left: 5,
      top: 5,
      width: 5,
      height: 5,
    })
    expect(intersectRect({ left: 0, top: 0, width: 10, height: 10 }, { left: 10, top: 0, width: 5, height: 5 })).toBeNull()
  })
})
