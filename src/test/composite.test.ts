import { describe, it, expect } from 'vitest'
import { applyMaskToImageData } from '../services/background-removal/composite'

describe('Mask Compositing (source + alpha mask -> cutout)', () => {
  it('applies grayscale mask to source image data alpha channel', () => {
    // 2x2 image: all red pixels [R, G, B, A]
    const sourceData = new Uint8ClampedArray([
      255, 0, 0, 255,   // pixel (0,0)
      255, 0, 0, 255,   // pixel (1,0)
      255, 0, 0, 255,   // pixel (0,1)
      255, 0, 0, 255,   // pixel (1,1)
    ])

    // 2x2 mask: top-left white (keep), top-right black (remove), bottom-left 128 (semi), bottom-right white
    const maskData = new Uint8ClampedArray([
      255, 255, 255, 255, // 255
      0, 0, 0, 255,       // 0
      128, 128, 128, 255, // 128
      255, 255, 255, 255  // 255
    ])

    const resultData = applyMaskToImageData(sourceData, maskData, 2, 2)

    // Pixel 0,0: red, alpha 255
    expect(resultData[0]).toBe(255)
    expect(resultData[3]).toBe(255)

    // Pixel 1,0: red, alpha 0 (fully removed)
    expect(resultData[4]).toBe(255)
    expect(resultData[7]).toBe(0)

    // Pixel 0,1: red, alpha 128 (semi-transparent)
    expect(resultData[8]).toBe(255)
    expect(resultData[11]).toBe(128)

    // Pixel 1,1: red, alpha 255
    expect(resultData[12]).toBe(255)
    expect(resultData[15]).toBe(255)
  })

  it('supports opacity scaling on mask', () => {
    const sourceData = new Uint8ClampedArray([255, 0, 0, 255])
    const maskData = new Uint8ClampedArray([255, 255, 255, 255])

    const resultData = applyMaskToImageData(sourceData, maskData, 1, 1, { opacity: 0.5 })
    expect(resultData[3]).toBe(128) // 255 * 0.5 rounded
  })

  it('supports feathering / soft thresholding', () => {
    const sourceData = new Uint8ClampedArray([255, 0, 0, 255])
    const maskData = new Uint8ClampedArray([100, 100, 100, 255])

    // With a hard threshold at 128, 100 becomes 0
    const resultWithThreshold = applyMaskToImageData(sourceData, maskData, 1, 1, { threshold: 128 })
    expect(resultWithThreshold[3]).toBe(0)
  })
})
