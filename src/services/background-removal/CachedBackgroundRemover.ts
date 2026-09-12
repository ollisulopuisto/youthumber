import type { BackgroundRemover, ImageSource, RemovalOptions, RemovalResult } from './types'

/**
 * Generates a simple 32-bit FNV-1a hash string for fast cache key generation
 */
function fastHash(str: string): string {
  let hash = 2166136261
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16)
}

function serializeSource(source: ImageSource): string {
  if (typeof source === 'string') {
    // For long data URLs, hash sample and length to avoid gigantic string keys
    if (source.length > 512) {
      const head = source.slice(0, 128)
      const tail = source.slice(-128)
      return `str_${source.length}_${fastHash(head + tail)}`
    }
    return source
  }
  if (source instanceof Blob) {
    return `blob_${source.size}_${source.type}`
  }
  if ('width' in source && 'height' in source) {
    return `dim_${source.width}x${source.height}`
  }
  return 'unknown_source'
}

export class CachedBackgroundRemover implements BackgroundRemover {
  readonly id: string
  readonly name: string
  private readonly inner: BackgroundRemover
  private readonly cache: Map<string, RemovalResult> = new Map()
  private readonly maxCacheEntries: number

  constructor(inner: BackgroundRemover, maxEntries = 50) {
    this.inner = inner
    this.id = `cached-${inner.id}`
    this.name = `Cached ${inner.name}`
    this.maxCacheEntries = maxEntries
  }

  async isAvailable(): Promise<boolean> {
    return this.inner.isAvailable()
  }

  computeCacheKey(image: ImageSource, options: RemovalOptions = {}): string {
    const srcKey = serializeSource(image)
    const optKey = JSON.stringify({
      feather: options.feather,
      threshold: options.threshold,
      device: options.device,
      model: options.model,
    })
    return `${this.inner.id}::${srcKey}::${fastHash(optKey)}`
  }

  getCacheSize(): number {
    return this.cache.size
  }

  clearCache(): void {
    this.cache.clear()
  }

  hasCached(image: ImageSource, options: RemovalOptions = {}): boolean {
    const key = this.computeCacheKey(image, options)
    return this.cache.has(key)
  }

  async remove(image: ImageSource, options: RemovalOptions = {}): Promise<RemovalResult> {
    const cacheKey = this.computeCacheKey(image, options)

    const cached = this.cache.get(cacheKey)
    if (cached) {
      return {
        ...cached,
        metadata: {
          ...cached.metadata,
          backendId: cached.metadata?.backendId ?? this.inner.id,
          cached: true,
        },
      }
    }

    const result = await this.inner.remove(image, options)

    // Store in cache (evict oldest if over limit)
    if (this.cache.size >= this.maxCacheEntries) {
      const oldestKey = this.cache.keys().next().value
      if (oldestKey) {
        this.cache.delete(oldestKey)
      }
    }

    this.cache.set(cacheKey, result)
    return result
  }
}
