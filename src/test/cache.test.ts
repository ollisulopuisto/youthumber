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

  it('drops the oldest results once the cutouts it holds exceed the byte budget', async () => {
    // Each removal of a new photo adds a multi-MB cutout; over a session that added up.
    const inner = {
      id: 'big',
      name: 'Big',
      isAvailable: async () => true,
      remove: async (image: string) => ({
        image: `cutout-${image}`.padEnd(1000, 'x'),
        mask: `mask-${image}`.padEnd(500, 'x'),
        source: image,
      }),
    }
    const cachedRemover = new CachedBackgroundRemover(inner, 50, 3200)

    await cachedRemover.remove('photo1')
    await cachedRemover.remove('photo2')
    await cachedRemover.remove('photo3')

    expect(cachedRemover.getCacheSize()).toBe(2)
    expect(cachedRemover.getCacheBytes()).toBe(3000)
    expect(cachedRemover.hasCached('photo1')).toBe(false)
    expect(cachedRemover.hasCached('photo3')).toBe(true)
  })

  it('does not count or keep the source photo, but still returns it on a hit', async () => {
    const inner = new MockBackgroundRemover()
    const cachedRemover = new CachedBackgroundRemover(inner)
    const photo = 'data:image/png;base64,' + 'p'.repeat(5000)

    await cachedRemover.remove(photo)
    const hit = await cachedRemover.remove(photo)

    expect(cachedRemover.getCacheBytes()).toBeLessThan(1000)
    expect(hit.source).toBe(photo)
    expect(hit.metadata?.cached).toBe(true)
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
