import { describe, expect, it } from 'vitest'
import { isMapTransparent } from '../modules/thumbnail/alphaHitTest'

function map(width: number, height: number, opaque: Array<[number, number]>) {
  const alpha = new Uint8Array(width * height)
  for (const [x, y] of opaque) alpha[y * width + x] = 255
  return { width, height, scale: 1, alpha }
}

describe('isMapTransparent', () => {
  it('hits an opaque pixel and misses a transparent one', () => {
    const m = map(10, 10, [[5, 5]])
    expect(isMapTransparent(m, 5.4, 5.6, 0)).toBe(false)
    expect(isMapTransparent(m, 2, 2, 0)).toBe(true)
  })

  it('counts opaque pixels within the tolerance radius as hits', () => {
    const m = map(10, 10, [[5, 5]])
    expect(isMapTransparent(m, 3, 5, 1)).toBe(true)
    expect(isMapTransparent(m, 3, 5, 2)).toBe(false)
  })

  it('treats points outside the map as transparent', () => {
    const m = map(4, 4, [[0, 0]])
    expect(isMapTransparent(m, -20, -20, 1)).toBe(true)
    expect(isMapTransparent(m, 30, 2, 0)).toBe(true)
  })
})
