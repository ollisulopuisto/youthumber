import { describe, it, expect } from 'vitest'
import { computeAutoFrameTransform, computeCutoutBBox } from '../modules/thumbnail/autoFrame'
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

describe('computeCutoutBBox', () => {
  it('bounds subject correctly and handles transparent / edge cases', async () => {
    let currentMockPaint: ((ctx: CanvasRenderingContext2D) => void) | null = null

    const origSrcDescriptor = Object.getOwnPropertyDescriptor(globalThis.HTMLImageElement.prototype, 'src')
    Object.defineProperty(globalThis.HTMLImageElement.prototype, 'src', {
      set(this: HTMLImageElement, _val: string) {
        Object.defineProperty(this, 'naturalWidth', { value: 240, configurable: true })
        Object.defineProperty(this, 'naturalHeight', { value: 135, configurable: true })
        setTimeout(() => {
          if (this.onload) (this.onload as () => void).call(this)
        }, 0)
      },
      configurable: true,
    })

    const origCreateElement = document.createElement.bind(document)
    document.createElement = ((tag: string) => {
      const el = origCreateElement(tag)
      if (tag === 'canvas') {
        const canvasEl = el as HTMLCanvasElement
        const origGetContext = canvasEl.getContext.bind(canvasEl)
        canvasEl.getContext = ((type: string, ...args: unknown[]) => {
          const ctx = (origGetContext as unknown as (...a: unknown[]) => unknown)(type, ...args)
          if (type === '2d' && ctx) {
            const ctx2d = ctx as CanvasRenderingContext2D
            ctx2d.drawImage = () => {}
            if (currentMockPaint) {
              currentMockPaint(ctx2d)
            }
          }
          return ctx
        }) as typeof canvasEl.getContext
      }
      return el
    }) as typeof document.createElement

    try {
      // 1. Fully transparent image
      currentMockPaint = () => {}
      const bboxEmpty = await computeCutoutBBox('mock://empty')
      expect(bboxEmpty).toBeNull()

      // 2. Centered box: x in [60, 180), y in [30, 90)
      currentMockPaint = (ctx) => {
        ctx.fillStyle = 'rgba(255, 0, 0, 1)'
        ctx.fillRect(60, 30, 120, 60)
      }
      const bboxCentred = await computeCutoutBBox('mock://centred')
      expect(bboxCentred).not.toBeNull()
      expect(bboxCentred!.nx1).toBeCloseTo(60 / 240, 2)
      expect(bboxCentred!.ny1).toBeCloseTo(30 / 135, 2)
      expect(bboxCentred!.nx2).toBeCloseTo(180 / 240, 2)
      expect(bboxCentred!.ny2).toBeCloseTo(90 / 135, 2)

      // 3. Single pixel at top-left (0, 0)
      currentMockPaint = (ctx) => {
        ctx.fillStyle = 'rgba(255, 255, 255, 1)'
        ctx.fillRect(0, 0, 1, 1)
      }
      const bboxTopLeft = await computeCutoutBBox('mock://topleft')
      expect(bboxTopLeft).not.toBeNull()
      expect(bboxTopLeft!.nx1).toBe(0)
      expect(bboxTopLeft!.ny1).toBe(0)
      expect(bboxTopLeft!.nx2).toBe(1 / 240)
      expect(bboxTopLeft!.ny2).toBe(1 / 135)

      // 4. Single pixel at bottom-right (239, 134)
      currentMockPaint = (ctx) => {
        ctx.fillStyle = 'rgba(255, 255, 255, 1)'
        ctx.fillRect(239, 134, 1, 1)
      }
      const bboxBottomRight = await computeCutoutBBox('mock://bottomright')
      expect(bboxBottomRight).not.toBeNull()
      expect(bboxBottomRight!.nx1).toBe(239 / 240)
      expect(bboxBottomRight!.ny1).toBe(134 / 135)
      expect(bboxBottomRight!.nx2).toBe(1)
      expect(bboxBottomRight!.ny2).toBe(1)
    } finally {
      if (origSrcDescriptor) {
        Object.defineProperty(globalThis.HTMLImageElement.prototype, 'src', origSrcDescriptor)
      }
      document.createElement = origCreateElement
    }
  })
})
