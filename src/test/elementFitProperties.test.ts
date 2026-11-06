import { expect, it } from 'vitest'
import { ELEMENTS } from '../data/elements'
import { fitElementToBox } from '../modules/thumbnail/elementFit'

const baseSeed = Number(process.env.FUZZ_SEED ?? 20261106) >>> 0
for (const seed of [baseSeed, (baseSeed + 1) >>> 0, (baseSeed + 2) >>> 0]) {
  it(`element placement is translation and full-turn invariant seed=${seed}`, () => {
    let state = seed
    const next = () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0)
    const specs = ELEMENTS.filter(spec => spec.fit)
    for (let caseId = 0; caseId < 120; caseId++) {
      const spec = specs[next() % specs.length]
      const box = { x: next() % 1000, y: next() % 700, width: 50 + next() % 900,
        height: 30 + next() % 300, rotation: (next() % 360) - 180 }
      const before = structuredClone({ spec, box })
      const fitted = fitElementToBox(spec, box)!
      const dx = (next() % 200) - 100
      const dy = (next() % 200) - 100
      const moved = fitElementToBox(spec, { ...box, x: box.x + dx, y: box.y + dy })!
      const context = `seed=${seed} case=${caseId} spec=${spec.id} box=${JSON.stringify(box)}`
      expect(moved, context).toEqual({ ...fitted, x: fitted.x + dx, y: fitted.y + dy })
      const turned = fitElementToBox(spec, { ...box, rotation: box.rotation + 360 })!
      // Floating-point trig around a half-pixel can round opposite ways after
      // a full turn. Size/rotation stay exact; raster placement differs by <=1px.
      expect(Math.abs(turned.x - fitted.x), context).toBeLessThanOrEqual(1)
      expect(Math.abs(turned.y - fitted.y), context).toBeLessThanOrEqual(1)
      expect({ ...turned, x: fitted.x, y: fitted.y }, context)
        .toEqual({ ...fitted, rotation: fitted.rotation + 360 })
      expect({ spec, box }, context).toEqual(before)
      expect(Object.values(fitted).every(Number.isFinite), context).toBe(true)
    }
  })
}


it('retains the tape half-pixel full-turn fixture', () => {
  const spec = ELEMENTS.find(item => item.id === 'tape')!
  const box = { x: 158, y: 637, width: 638, height: 197, rotation: -90 }
  const a = fitElementToBox(spec, box)!
  const b = fitElementToBox(spec, { ...box, rotation: 270 })!
  expect(Math.abs(a.x - b.x)).toBeLessThanOrEqual(1)
  expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(1)
  expect(b.width).toBe(a.width)
  expect(b.height).toBe(a.height)
})
