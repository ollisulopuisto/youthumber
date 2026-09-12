import type { BackgroundRemover, ImageSource, RemovalOptions, RemovalResult } from './types'

export interface MockRemoverConfig {
  shouldFail?: boolean
  errorMessage?: string
  delayMs?: number
  id?: string
  name?: string
}

// 1x1 transparent PNG data URL
const DEFAULT_TRANSPARENT_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

// 1x1 white PNG (alpha mask) data URL
const DEFAULT_MASK_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

export class MockBackgroundRemover implements BackgroundRemover {
  readonly id: string
  readonly name: string
  private readonly config: MockRemoverConfig

  constructor(config: MockRemoverConfig = {}) {
    this.config = config
    this.id = config.id ?? 'mock-remover'
    this.name = config.name ?? 'Deterministic Mock Remover'
  }

  async isAvailable(): Promise<boolean> {
    return true
  }

  async remove(image: ImageSource, options: RemovalOptions = {}): Promise<RemovalResult> {
    if (this.config.shouldFail) {
      throw new Error(this.config.errorMessage ?? 'Mock removal failed intentionally')
    }

    const { onProgress, signal } = options

    if (signal?.aborted) {
      throw new DOMException('Removal aborted', 'AbortError')
    }

    onProgress?.(10, 'Initializing model')
    if (this.config.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, this.config.delayMs! / 3))
    }

    onProgress?.(50, 'Segmenting foreground')
    if (this.config.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, this.config.delayMs! / 3))
    }

    onProgress?.(100, 'Generating alpha mask')

    const startTime = Date.now()

    return {
      image: DEFAULT_TRANSPARENT_PNG,
      mask: DEFAULT_MASK_PNG,
      source: image,
      metadata: {
        backendId: this.id,
        modelId: 'mock-v1',
        executionTimeMs: Date.now() - startTime,
      },
    }
  }
}
