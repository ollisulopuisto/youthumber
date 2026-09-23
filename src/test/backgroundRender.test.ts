import { describe, it, expect } from 'vitest'
import {
  cssGradient,
  gradientSpec,
  vignetteColorStops,
  photoFilterValues,
} from '../modules/thumbnail/backgroundRender'

describe('gradientSpec', () => {
  it('runs a 0° linear gradient left to right across the canvas centre', () => {
    const spec = gradientSpec({ colors: ['#000', '#fff'], angle: 0 }, 1280, 720)

    expect(spec.type).toBe('linear')
    expect(spec.coords.y1).toBeCloseTo(360)
    expect(spec.coords.y2).toBeCloseTo(360)
    expect(spec.coords.x1).toBeLessThan(0)
    expect(spec.coords.x2).toBeGreaterThan(1280)
  })

  it('makes a radial gradient from the canvas centre out to the corners', () => {
    const spec = gradientSpec({ colors: ['#fff', '#000'], angle: 0, type: 'radial' }, 1280, 720)

    expect(spec.type).toBe('radial')
    expect(spec.coords).toMatchObject({ x1: 640, y1: 360, r1: 0, x2: 640, y2: 360 })
    expect(spec.coords.r2).toBeCloseTo(Math.hypot(640, 360))
  })

  it('spreads colour stops evenly, first at 0 and last at 1', () => {
    const spec = gradientSpec({ colors: ['#a00', '#0a0', '#00a'], angle: 90 }, 1280, 720)

    expect(spec.colorStops).toEqual([
      { offset: 0, color: '#a00' },
      { offset: 0.5, color: '#0a0' },
      { offset: 1, color: '#00a' },
    ])
  })

  it('treats a missing type as linear, for gradients saved before radial existed', () => {
    expect(gradientSpec({ colors: ['#000', '#fff'], angle: 45 }, 1280, 720).type).toBe('linear')
  })
})

describe('cssGradient', () => {
  it('draws swatches at the same angle as the canvas (CSS 0deg points up, canvas 0 points right)', () => {
    expect(cssGradient({ colors: ['#000', '#fff'], angle: 0 })).toBe('linear-gradient(90deg, #000, #fff)')
    expect(cssGradient({ colors: ['#000', '#fff'], angle: 90 })).toBe('linear-gradient(180deg, #000, #fff)')
  })

  it('draws radial swatches as a circle from the centre', () => {
    expect(cssGradient({ colors: ['#fff', '#000'], angle: 0, type: 'radial' })).toBe(
      'radial-gradient(circle, #fff, #000)'
    )
  })
})

describe('vignetteColorStops', () => {
  it('is clear in the middle and darkest at the edges, scaled by strength', () => {
    const stops = vignetteColorStops(0.6)

    expect(stops[0]).toEqual({ offset: 0, color: 'rgba(0,0,0,0)' })
    expect(stops.at(-1)).toEqual({ offset: 1, color: 'rgba(0,0,0,0.6)' })
  })
})

describe('photoFilterValues', () => {
  it('turns blur in canvas pixels and darken 0–1 into Fabric filter values', () => {
    expect(photoFilterValues({ imageBlur: 0, imageDarken: 0 })).toEqual({ blur: 0, brightness: 0 })
    // Measured 2026-09-23: Fabric Blur 0.1 softens an edge across ~18px of a 1920-wide
    // image, i.e. ~0.0925 x value x width. On the 1280-wide canvas, ~12px of soft edge
    // therefore needs 0.1 — the first mapping (px / 1280) blurred ~9x too little to see.
    const { blur, brightness } = photoFilterValues({ imageBlur: 11.84, imageDarken: 0.4 })
    expect(blur).toBeCloseTo(0.1, 3)
    expect(brightness).toBe(-0.4)
  })

  it('defaults missing settings to no change, for backgrounds saved before these existed', () => {
    expect(photoFilterValues({})).toEqual({ blur: 0, brightness: 0 })
  })
})
