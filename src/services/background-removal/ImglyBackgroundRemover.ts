import { removeBackground, segmentForeground } from '@imgly/background-removal'
import type { BackgroundRemover, ImageSource, RemovalOptions, RemovalResult } from './types'

export class ImglyBackgroundRemover implements BackgroundRemover {
  readonly id = 'imgly-wasm'
  readonly name = '@imgly/background-removal (WebAssembly/WebGPU)'

  async isAvailable(): Promise<boolean> {
    return typeof window !== 'undefined'
  }

  async remove(image: ImageSource, options: RemovalOptions = {}): Promise<RemovalResult> {
    const { onProgress, signal } = options
    const startTime = Date.now()

    if (signal?.aborted) {
      throw new DOMException('Removal aborted', 'AbortError')
    }

    // Prepare image as Blob or URL
    let inputSource: Blob | string = image as any
    if (typeof image === 'string' && image.startsWith('data:')) {
      const resp = await fetch(image)
      inputSource = await resp.blob()
    }

    onProgress?.(10, 'Initializing WebAssembly model')

    // Run background removal
    const cutoutBlob = await removeBackground(inputSource as any, {
      progress: (_key, current, total) => {
        if (total > 0) {
          const pct = Math.min(95, Math.round((current / total) * 100))
          onProgress?.(pct, 'Processing image')
        }
      },
    })

    // Extract alpha mask
    let maskBlob: Blob
    try {
      maskBlob = await segmentForeground(inputSource as any)
    } catch {
      // Fallback: If mask separation fails, use cutout blob
      maskBlob = cutoutBlob
    }

    onProgress?.(100, 'Complete')

    return {
      image: cutoutBlob,
      mask: maskBlob,
      source: image,
      metadata: {
        backendId: this.id,
        modelId: 'isnet-general-use',
        executionTimeMs: Date.now() - startTime,
      },
    }
  }
}
