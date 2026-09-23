import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { LocalCoreMLRemover } from '../services/background-removal/LocalCoreMLRemover'

describe('LocalCoreMLRemover Adapter', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('identifies as coreml-local with Apple Silicon description', () => {
    const remover = new LocalCoreMLRemover()
    expect(remover.id).toBe('coreml-local')
    expect(remover.name).toContain('Apple Silicon Core ML')
  })

  it('reports unavailable when server does not respond to health check', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'))
    const remover = new LocalCoreMLRemover('http://127.0.0.1:5055')

    const available = await remover.isAvailable()
    expect(available).toBe(false)
  })

  it('reports available when server returns 200 OK', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'ready', model: 'birefnet-coreml' }),
    } as any)
    const remover = new LocalCoreMLRemover('http://127.0.0.1:5055')

    const available = await remover.isAvailable()
    expect(available).toBe(true)
  })

  it('posts image and returns cutout and mask from server', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        image: 'data:image/png;base64,cutoutData',
        mask: 'data:image/png;base64,maskData',
        metadata: {
          backendId: 'coreml-local',
          modelId: 'birefnet-m2-metal',
          executionTimeMs: 42,
        },
      }),
    } as any)

    const remover = new LocalCoreMLRemover('http://127.0.0.1:5055')
    const onProgress = vi.fn()
    const result = await remover.remove('data:image/jpeg;base64,sourceImage', { onProgress })

    expect(result.image).toBe('data:image/png;base64,cutoutData')
    expect(result.mask).toBe('data:image/png;base64,maskData')
    expect(result.metadata?.modelId).toBe('birefnet-m2-metal')
    expect(onProgress).toHaveBeenCalled()
  })

  it('throws descriptive error if server returns error response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Error',
      text: async () => 'Core ML inference failed',
    } as any)

    const remover = new LocalCoreMLRemover('http://127.0.0.1:5055')
    await expect(remover.remove('data:image/jpeg;base64,source')).rejects.toThrow(/Core ML inference failed/)
  })

  it('autoDetectBestRemover selects coreml-local when available', async () => {
    const { autoDetectBestRemover, defaultRemoverRegistry } = await import('../services/background-removal')
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'ready' }),
    } as any)

    const detected = await autoDetectBestRemover()
    expect(detected).toBe(true)
    expect(defaultRemoverRegistry.getActive().id).toContain('coreml-local')
  })

  // With the BiRefNet model the engine also sends the mask with objects (mic stand,
  // chair), so "Keep objects" can switch without running the model again.
  it('passes on the objects mask when the engine sends one', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        image: 'data:image/png;base64,cut',
        mask: 'data:image/png;base64,person',
        objectsMask: 'data:image/png;base64,objects',
        metadata: { modelId: 'birefnet-general+apple-vision' },
      }),
    } as any)

    const result = await new LocalCoreMLRemover('http://127.0.0.1:5055').remove('data:x')

    expect(result.objectsMask).toBe('data:image/png;base64,objects')
  })
})
