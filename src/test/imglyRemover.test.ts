import { describe, it, expect, vi } from 'vitest'
import { ImglyBackgroundRemover } from '../services/background-removal/ImglyBackgroundRemover'

// Mock the heavy @imgly/background-removal module for fast isolated unit tests
vi.mock('@imgly/background-removal', () => ({
  removeBackground: vi.fn().mockImplementation(async (_image, options) => {
    options?.progress?.('compute:inference', 1, 1)
    return new Blob(['fake-cutout-png'], { type: 'image/png' })
  }),
  segmentForeground: vi.fn().mockImplementation(async () => {
    return new Blob(['fake-mask-png'], { type: 'image/png' })
  }),
}))

describe('ImglyBackgroundRemover Adapter', () => {
  it('identifies with id imgly-wasm', () => {
    const remover = new ImglyBackgroundRemover()
    expect(remover.id).toBe('imgly-wasm')
    expect(remover.name).toContain('@imgly')
  })

  it('removes background and produces both cutout and mask blobs', async () => {
    const remover = new ImglyBackgroundRemover()
    const onProgress = vi.fn()
    const sampleInput = new Blob(['test-image'], { type: 'image/jpeg' })

    const result = await remover.remove(sampleInput, { onProgress })

    expect(result).toBeDefined()
    expect(result.image).toBeDefined()
    expect(result.mask).toBeDefined()
    expect(result.metadata?.backendId).toBe('imgly-wasm')
    expect(onProgress).toHaveBeenCalled()
  })
})
