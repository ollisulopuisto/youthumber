import { describe, it, expect } from 'vitest'
import {
  accentLineIndices,
  accentLineStyles,
  extrusionOffsets,
  seededRandom,
  skewXToSlant,
  slantToSkewX,
  splashShapes,
  textGradientSpec,
} from '../modules/thumbnail/textEffects'
import { TEXT_LOOKS } from '../data/textLooks'
import { STUDIO_FONTS } from '../data/studioFonts'

describe('slant', () => {
  it('leans forward for a positive slant and round-trips through skewX', () => {
    expect(slantToSkewX(10)).toBe(-10)
    expect(skewXToSlant(slantToSkewX(12))).toBe(12)
    expect(skewXToSlant(0)).toBe(0)
    expect(slantToSkewX(undefined)).toBe(-0)
  })
})

describe('extrusionOffsets', () => {
  it('is empty without depth', () => {
    expect(extrusionOffsets(0)).toEqual([])
    expect(extrusionOffsets(undefined)).toEqual([])
  })

  it('has one layer per pixel, deepest first, in the given direction', () => {
    const offsets = extrusionOffsets(4, 90)
    expect(offsets).toHaveLength(4)
    expect(offsets[0].y).toBeCloseTo(4)
    expect(offsets[3].y).toBeCloseTo(1)
    expect(offsets[0].x).toBeCloseTo(0)
  })
})

describe('accent lines', () => {
  it('picks the right lines for each mode', () => {
    expect(accentLineIndices(3, 'none')).toEqual([])
    expect(accentLineIndices(3, 'first')).toEqual([0])
    expect(accentLineIndices(3, 'last')).toEqual([2])
    expect(accentLineIndices(4, 'alternate')).toEqual([1, 3])
    expect(accentLineIndices(0, 'first')).toEqual([])
  })

  it('colours every character of an accent line and skips empty lines', () => {
    const lines = [['N', 'E', 'W'], [], ['G', 'O']]
    expect(accentLineStyles(lines, 'first', '#FFE600')).toEqual({
      0: { 0: { fill: '#FFE600' }, 1: { fill: '#FFE600' }, 2: { fill: '#FFE600' } },
    })
    expect(accentLineStyles(lines, 'alternate', '#FFE600')).toEqual({})
    expect(accentLineStyles(lines, 'first', undefined)).toEqual({})
  })
})

describe('textGradientSpec', () => {
  it('runs top to bottom over the text height', () => {
    const spec = textGradientSpec(['#FFE600', '#FF3D00'], 140)
    expect(spec.coords).toEqual({ x1: 0, y1: 0, x2: 0, y2: 140 })
    expect(spec.colorStops.map((s) => s.color)).toEqual(['#FFE600', '#FF3D00'])
  })
})

describe('splashShapes', () => {
  it('draws nothing for none or an unknown style', () => {
    expect(splashShapes('none', 400, 100)).toEqual([])
    expect(splashShapes('zigzag', 400, 100)).toEqual([])
  })

  it('keeps the same shape for the same seed and changes with a new one', () => {
    for (const style of ['burst', 'splat', 'brush']) {
      expect(splashShapes(style, 400, 100, 7)).toEqual(splashShapes(style, 400, 100, 7))
      expect(splashShapes(style, 400, 100, 7)).not.toEqual(splashShapes(style, 400, 100, 8))
    }
  })

  it('surrounds the text box', () => {
    for (const style of ['burst', 'splat', 'brush']) {
      const points = splashShapes(style, 400, 100, 3, 1).flatMap((s) =>
        s.type === 'polygon' ? s.points : [{ x: s.x, y: s.y }]
      )
      expect(Math.max(...points.map((p) => p.x))).toBeGreaterThan(200)
      expect(Math.min(...points.map((p) => p.x))).toBeLessThan(-200)
      expect(Math.max(...points.map((p) => p.y))).toBeGreaterThan(50)
      expect(points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true)
    }
  })

  it('grows with size', () => {
    const width = (size: number) =>
      Math.max(...(splashShapes('burst', 400, 100, 5, size)[0] as { points: { x: number }[] }).points.map((p) => p.x))
    expect(width(1.5)).toBeGreaterThan(width(1))
  })
})

describe('seededRandom', () => {
  it('stays within [0, 1)', () => {
    const rand = seededRandom(42)
    for (let i = 0; i < 1000; i++) {
      const value = rand()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })
})

describe('TEXT_LOOKS', () => {
  it('only uses studio fonts in weights they have', () => {
    for (const look of TEXT_LOOKS) {
      const { fontFamily, fontWeight } = look.style as { fontFamily?: string; fontWeight?: string }
      if (!fontFamily) continue
      const font = STUDIO_FONTS.find((f) => f.family === fontFamily)
      expect(font, look.id).toBeDefined()
      expect(font!.weights).toContain(Number(fontWeight))
    }
  })
})
