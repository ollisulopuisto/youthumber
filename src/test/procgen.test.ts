import { describe, it, expect } from 'vitest'
import {
  PROCGEN_STYLES,
  mulberry32,
  paletteAt,
  renderProcgen,
  valueNoise,
} from '../modules/thumbnail/procgen'

/** A recording 2D context: logs every call so two renders can be compared without a real canvas. */
function fakeCanvas(width: number, height: number, log: string[]) {
  const handler: ProxyHandler<object> = {
    get(_t, prop: string) {
      if (prop === 'canvas') return canvas
      if (prop === 'createImageData')
        return (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) })
      if (prop === 'putImageData')
        return (img: { data: Uint8ClampedArray }) => {
          let sum = 0
          for (let i = 0; i < img.data.length; i++) sum = (sum * 31 + img.data[i]) % 1_000_003
          log.push(`putImageData(${sum})`)
        }
      if (prop === 'createRadialGradient' || prop === 'createLinearGradient')
        return (...a: number[]) => {
          log.push(`${prop}(${a.map((n) => n.toFixed(2))})`)
          return { addColorStop: (o: number, c: string) => log.push(`stop(${o},${c})`) }
        }
      return (...a: unknown[]) => {
        log.push(`${prop}(${a.map((n) => (typeof n === 'number' ? n.toFixed(2) : typeof n === 'object' ? 'obj' : n))})`)
      }
    },
    set(_t, prop: string, value: unknown) {
      log.push(`${prop}=${typeof value === 'object' ? 'obj' : value}`)
      return true
    },
  }
  const ctx = new Proxy({}, handler)
  const canvas = { width, height, getContext: () => ctx, toDataURL: () => `data:${log.join('|')}` }
  return canvas
}

const COLORS = ['#0F172A', '#F59E0B']
const render = (id: string, seed: number, colors = COLORS) => {
  const log: string[] = [] // shared, so offscreen canvases count towards the result
  const canvas = fakeCanvas(192, 108, log)
  let first = true
  const makeCanvas = (w: number, h: number) => {
    if (first) {
      first = false
      return canvas
    }
    return fakeCanvas(w, h, log)
  }
  return renderProcgen(id, { colors, seed, width: 192, height: 108, makeCanvas: makeCanvas as never })
}

describe('mulberry32', () => {
  it('is deterministic and stays in [0, 1)', () => {
    const a = mulberry32(7)
    const b = mulberry32(7)
    for (let i = 0; i < 50; i++) {
      const v = a()
      expect(v).toBe(b())
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('valueNoise', () => {
  it('is deterministic per seed, bounded, and varies', () => {
    const n = valueNoise(3)
    const m = valueNoise(3)
    const values = new Set<number>()
    for (let i = 0; i < 40; i++) {
      const v = n(i * 0.37, i * 0.21)
      expect(v).toBe(m(i * 0.37, i * 0.21))
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
      values.add(Math.round(v * 1000))
    }
    expect(values.size).toBeGreaterThan(10)
  })
})

describe('paletteAt', () => {
  it('hits the end colours and blends between', () => {
    expect(paletteAt(['#000000', '#ffffff'], 0)).toEqual([0, 0, 0])
    expect(paletteAt(['#000000', '#ffffff'], 1)).toEqual([255, 255, 255])
    expect(paletteAt(['#000000', '#ffffff'], 0.5)).toEqual([128, 128, 128])
  })
})

describe('PROCGEN_STYLES', () => {
  it('offers at least eight styles with unique ids and names', () => {
    expect(PROCGEN_STYLES.length).toBeGreaterThanOrEqual(8)
    expect(new Set(PROCGEN_STYLES.map((s) => s.id)).size).toBe(PROCGEN_STYLES.length)
    PROCGEN_STYLES.forEach((s) => expect(s.name).toBeTruthy())
  })

  for (const { id } of PROCGEN_STYLES) {
    it(`${id}: same seed repeats, another seed differs, colours matter`, () => {
      const first = render(id, 11)
      expect(first.length).toBeGreaterThan(30)
      expect(render(id, 11)).toBe(first)
      expect(render(id, 12)).not.toBe(first)
      expect(render(id, 11, ['#220033', '#00FFAA'])).not.toBe(first)
    })
  }

  it('rejects an unknown style', () => {
    expect(() => render('nope', 1)).toThrow(/unknown/i)
  })
})
