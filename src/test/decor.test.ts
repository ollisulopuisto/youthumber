import { describe, it, expect } from 'vitest'
import {
  DECOR_ELEMENTS,
  arrowHead,
  decorElement,
  decorShapes,
  defaultDecor,
  hasDecor,
  randomDecor,
  withDecorLayer,
} from '../modules/thumbnail/decor'
import { createDefaultProject, updateDecor } from '../modules/thumbnail/thumbnailState'
import { LOUD_COLORS, accentBoxes, splashShapes } from '../modules/thumbnail/textEffects'

const allOn = (seed = 1) => ({
  visible: true,
  seed,
  elements: Object.fromEntries(DECOR_ELEMENTS.map((e) => [e.id, { on: true }])),
})

describe('decor layer order', () => {
  it('puts the Graphics layer above the background in old projects', () => {
    expect(withDecorLayer(['background', 'a', 'b', 'text'])).toEqual(['background', 'decor', 'a', 'b', 'text'])
  })

  it('keeps a layer order that already lists it', () => {
    const order = ['background', 'a', 'decor', 'text']
    expect(withDecorLayer(order)).toBe(order)
  })

  it('is in new projects, just above the background', () => {
    expect(createDefaultProject().layerOrder.slice(0, 2)).toEqual(['background', 'decor'])
  })
})

describe('decorElement', () => {
  it('is null when off and fills in defaults when on', () => {
    expect(decorElement(defaultDecor(), 'chart')).toBeNull()
    const decor = { ...defaultDecor(), elements: { chart: { on: true, color: '#FF0000' } } }
    expect(decorElement(decor, 'chart')).toMatchObject({ on: true, color: '#FF0000', position: 'right' })
    expect(hasDecor(decor)).toBe(true)
    expect(hasDecor({ ...decor, visible: false })).toBe(false)
  })
})

describe('decorShapes', () => {
  it('draws nothing when hidden or empty', () => {
    expect(decorShapes(defaultDecor())).toEqual([])
    expect(decorShapes({ ...allOn(), visible: false })).toEqual([])
  })

  it('draws every element with finite coordinates', () => {
    const shapes = decorShapes(allOn())
    expect(shapes.length).toBeGreaterThan(100)
    for (const shape of shapes) {
      const points = shape.kind === 'circle' ? [{ x: shape.x, y: shape.y }] : shape.points
      expect(points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true)
    }
  })

  it('keeps its shape for a seed and changes with a new one', () => {
    expect(decorShapes(allOn(5))).toEqual(decorShapes(allOn(5)))
    expect(decorShapes(allOn(5))).not.toEqual(decorShapes(allOn(6)))
  })

  it("doesn't reshape one element when another is switched on", () => {
    const chartOnly = { visible: true, seed: 3, elements: { chart: { on: true } } }
    const withArrow = { ...chartOnly, elements: { ...chartOnly.elements, arrow: { on: true } } }
    const chart = decorShapes(chartOnly)
    expect(decorShapes(withArrow).slice(0, chart.length)).toEqual(chart)
  })

  it('moves an element with its position', () => {
    const at = (position: string) => {
      const shapes = decorShapes({ visible: true, seed: 1, elements: { chart: { on: true, position } } })
      const xs = shapes.flatMap((s) => (s.kind === 'circle' ? [s.x] : s.points.map((p) => p.x)))
      return Math.min(...xs)
    }
    expect(at('left')).toBeLessThan(at('center'))
    expect(at('center')).toBeLessThan(at('right'))
  })
})

describe('arrowHead', () => {
  it('has its tip at the target', () => {
    const head = arrowHead({ x: 0, y: 0 }, { x: 100, y: 0 }, 20)
    expect(head[0]).toEqual({ x: 100, y: 0 })
    expect(head[1].x).toBeCloseTo(80)
    expect(Math.abs(head[1].y)).toBeCloseTo(12)
  })
})

describe('randomDecor', () => {
  it('switches on two to four elements and off the rest, in the given colours', () => {
    for (let i = 0; i < 20; i++) {
      const decor = randomDecor(LOUD_COLORS)
      const on = Object.values(decor.elements).filter((e) => e?.on)
      expect(Object.keys(decor.elements)).toHaveLength(DECOR_ELEMENTS.length)
      expect(on.length).toBeGreaterThanOrEqual(2)
      expect(on.length).toBeLessThanOrEqual(4)
      on.forEach((e) => expect(LOUD_COLORS).toContain(e!.color))
    }
  })
})

describe('updateDecor', () => {
  it('merges per element and starts old projects from an empty layer', () => {
    const { decor: _drop, ...old } = createDefaultProject()
    let project = updateDecor(old, { elements: { rays: { on: true } } })
    project = updateDecor(project, { elements: { rays: { color: '#00FF00' } } })
    expect(project.decor).toMatchObject({ visible: true, elements: { rays: { on: true, color: '#00FF00' } } })
  })
})

describe('text accents', () => {
  it('draws a rays splash as wedges around the text', () => {
    const shapes = splashShapes('rays', 400, 100, 2)
    expect(shapes).toHaveLength(16)
    expect(shapes.every((s) => s.type === 'polygon' && s.points[0].x === 0 && s.points[0].y === 0)).toBe(true)
  })

  it('puts a padded bar behind each accent line', () => {
    const metrics = [
      { left: -100, top: -50, width: 200, height: 40 },
      { left: -80, top: 0, width: 160, height: 40 },
    ]
    const boxes = accentBoxes(metrics, [1], 10)
    expect(boxes).toHaveLength(1)
    const xs = boxes[0].map((p) => p.x)
    expect(Math.min(...xs)).toBeLessThan(-90)
    expect(Math.max(...xs)).toBeGreaterThan(90)
    expect(accentBoxes(metrics, [5], 10)).toEqual([])
  })
})
