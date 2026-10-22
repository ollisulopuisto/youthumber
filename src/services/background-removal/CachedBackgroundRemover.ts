import type { BackgroundRemover, ImageSource, RemovalOptions, RemovalResult } from './types'

// A full-HD cutout PNG plus its masks is 5–10 MB of data URL; this holds the last
// handful of removals (a re-run on the same photo is free) without the cache itself
// growing into hundreds of MB over a long session.
const DEFAULT_MAX_BYTES = 64 * 1024 * 1024

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

function byteSize(value: unknown): number {
  if (typeof value === 'string') return value.length
  if (value instanceof Blob) return value.size
  return 0
}

/** What a cached result costs to keep: its cutout and masks. */
function resultBytes(result: RemovalResult): number {
  return byteSize(result.image) + byteSize(result.mask) + byteSize(result.objectsMask)
}

export class CachedBackgroundRemover implements BackgroundRemover {
  readonly id: string
  readonly name: string
  private readonly inner: BackgroundRemover
  private readonly cache: Map<string, RemovalResult> = new Map()
  private readonly maxCacheEntries: number
  private readonly maxCacheBytes: number
  private cacheBytes = 0

  constructor(inner: BackgroundRemover, maxEntries = 50, maxBytes = DEFAULT_MAX_BYTES) {
    this.inner = inner
    this.id = `cached-${inner.id}`
    this.name = `Cached ${inner.name}`
    this.maxCacheEntries = maxEntries
    this.maxCacheBytes = maxBytes
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

  /** Characters of data URL (or Blob bytes) the cache holds. */
  getCacheBytes(): number {
    return this.cacheBytes
  }

  clearCache(): void {
    this.cache.clear()
    this.cacheBytes = 0
  }

  hasCached(image: ImageSource, options: RemovalOptions = {}): boolean {
    const key = this.computeCacheKey(image, options)
    return this.cache.has(key)
  }

  private evict(key: string): void {
    const entry = this.cache.get(key)
    if (!entry) return
    this.cache.delete(key)
    this.cacheBytes -= resultBytes(entry)
  }

  async remove(image: ImageSource, options: RemovalOptions = {}): Promise<RemovalResult> {
    const cacheKey = this.computeCacheKey(image, options)

    const cached = this.cache.get(cacheKey)
    if (cached) {
      // Re-insert so eviction is least-recently-used.
      this.cache.delete(cacheKey)
      this.cache.set(cacheKey, cached)
      return {
        ...cached,
        source: image,
        metadata: {
          ...cached.metadata,
          backendId: cached.metadata?.backendId ?? this.inner.id,
          cached: true,
        },
      }
    }

    const result = await this.inner.remove(image, options)

    // The source photo is the caller's to keep; caching it too would pin every
    // photo ever cut out, even after it left the project.
    const stored: RemovalResult = { ...result }
    delete stored.source
    const bytes = resultBytes(stored)

    // Evict oldest entries until the new one fits (by count and by size).
    while (
      this.cache.size > 0 &&
      (this.cache.size >= this.maxCacheEntries || this.cacheBytes + bytes > this.maxCacheBytes)
    ) {
      this.evict(this.cache.keys().next().value!)
    }

    this.cache.set(cacheKey, stored)
    this.cacheBytes += bytes
    return result
  }
}
