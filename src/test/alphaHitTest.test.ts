import { describe, expect, it, vi } from 'vitest'
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

describe('installAlphaHitTest', () => {
  // A 100×50 image whose left half is opaque, drawn at 2× and flipped, on a canvas zoomed to 0.5.
  async function setup() {
    const { fabric } = await import('fabric')
    const { installAlphaHitTest } = await import('../modules/thumbnail/alphaHitTest')
    const element = { width: 100, height: 50, naturalWidth: 100, naturalHeight: 50 }
    const realCreate = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag !== 'canvas') return realCreate(tag)
      const fake = { width: 0, height: 0 } as unknown as HTMLCanvasElement
      ;(fake as unknown as { getContext: () => unknown }).getContext = () => ({
        drawImage: () => {},
        getImageData: (_x: number, _y: number, w: number, h: number) => {
          const data = new Uint8ClampedArray(w * h * 4)
          for (let y = 0; y < h; y++) for (let x = 0; x < w / 2; x++) data[(y * w + x) * 4 + 3] = 255
          return { data }
        },
      })
      return fake
    })
    const image = Object.create(fabric.Image.prototype)
    Object.assign(image, {
      width: 100, height: 50, left: 400, top: 200, scaleX: 2, scaleY: 2, angle: 0,
      flipX: false, flipY: false, skewX: 0, skewY: 0, originX: 'center', originY: 'center',
      cropX: 0, cropY: 0, filters: [], getElement: () => element,
    })
    const fallback = vi.fn(() => true)
    const canvas = {
      viewportTransform: [0.5, 0, 0, 0.5, 0, 0],
      getZoom: () => 0.5,
      targetFindTolerance: 0,
      isTargetTransparent: fallback,
    }
    installAlphaHitTest(canvas)
    return { image, canvas, fallback }
  }

  it('maps screen points through zoom and object transform onto the alpha map', async () => {
    const { image, canvas, fallback } = await setup()
    // Scene x 400 is the image centre; the opaque half spans scene x 300–400 (screen 150–200).
    expect(canvas.isTargetTransparent(image, 160, 100)).toBe(false)
    expect(canvas.isTargetTransparent(image, 240, 100)).toBe(true)
    image.flipX = true
    expect(canvas.isTargetTransparent(image, 160, 100)).toBe(true)
    expect(canvas.isTargetTransparent(image, 240, 100)).toBe(false)
    expect(fallback).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  })
})
