import { describe, it, expect, vi } from 'vitest'
import { MockBackgroundRemover } from '../services/background-removal/MockBackgroundRemover'
import { CachedBackgroundRemover } from '../services/background-removal/CachedBackgroundRemover'

describe('CachedBackgroundRemover', () => {
  it('delegates to inner remover on cache miss', async () => {
    const inner = new MockBackgroundRemover()
    const removeSpy = vi.spyOn(inner, 'remove')
    const cachedRemover = new CachedBackgroundRemover(inner)

    const img = 'data:image/png;base64,sample1'
    const result = await cachedRemover.remove(img)

    expect(removeSpy).toHaveBeenCalledTimes(1)
    expect(result.metadata?.cached).toBeFalsy()
    expect(cachedRemover.getCacheSize()).toBe(1)
  })

  it('serves subsequent requests from cache without calling inner remover', async () => {
    const inner = new MockBackgroundRemover()
    const removeSpy = vi.spyOn(inner, 'remove')
    const cachedRemover = new CachedBackgroundRemover(inner)

    const img = 'data:image/png;base64,sample2'
    const result1 = await cachedRemover.remove(img)
    const result2 = await cachedRemover.remove(img)

    expect(removeSpy).toHaveBeenCalledTimes(1)
    expect(result1.image).toBe(result2.image)
    expect(result2.metadata?.cached).toBe(true)
  })

  it('computes distinct cache keys for different options', async () => {
    const inner = new MockBackgroundRemover()
    const removeSpy = vi.spyOn(inner, 'remove')
    const cachedRemover = new CachedBackgroundRemover(inner)

    const img = 'data:image/png;base64,sample3'
    await cachedRemover.remove(img, { threshold: 100 })
    await cachedRemover.remove(img, { threshold: 200 })

    expect(removeSpy).toHaveBeenCalledTimes(2)
    expect(cachedRemover.getCacheSize()).toBe(2)
  })

  it('allows clearing the cache', async () => {
    const inner = new MockBackgroundRemover()
    const removeSpy = vi.spyOn(inner, 'remove')
    const cachedRemover = new CachedBackgroundRemover(inner)

    const img = 'data:image/png;base64,sample4'
    await cachedRemover.remove(img)
    expect(cachedRemover.getCacheSize()).toBe(1)

    cachedRemover.clearCache()
    expect(cachedRemover.getCacheSize()).toBe(0)

    await cachedRemover.remove(img)
    expect(removeSpy).toHaveBeenCalledTimes(2)
  })
})
