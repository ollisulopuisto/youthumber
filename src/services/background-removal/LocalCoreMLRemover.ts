import type { BackgroundRemover, ImageSource, RemovalOptions, RemovalResult } from './types'

export class LocalCoreMLRemover implements BackgroundRemover {
  readonly id = 'coreml-local'
  readonly name = 'Apple Silicon Core ML (BiRefNet / RMBG-2)'
  baseUrl: string

  constructor(baseUrl?: string) {
    if (baseUrl) {
      this.baseUrl = baseUrl.replace(/\/+$/, '')
    } else if (
      typeof window !== 'undefined' &&
      window.location?.origin?.startsWith('http') &&
      !window.location.origin.includes(':5173')
    ) {
      this.baseUrl = window.location.origin.replace(/\/+$/, '')
    } else {
      this.baseUrl = 'http://127.0.0.1:5055'
    }
  }

  async isAvailable(): Promise<boolean> {
    const checkUrl = async (url: string) => {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 1500)
        const res = await fetch(`${url}/health`, {
          method: 'GET',
          signal: controller.signal,
        })
        clearTimeout(timeoutId)
        return res.ok
      } catch {
        return false
      }
    }

    if (await checkUrl(this.baseUrl)) return true
    if (
      typeof window !== 'undefined' &&
      window.location?.origin &&
      window.location.origin !== this.baseUrl &&
      window.location.origin.startsWith('http')
    ) {
      if (await checkUrl(window.location.origin)) {
        this.baseUrl = window.location.origin
        return true
      }
    }
    return false
  }

  async remove(image: ImageSource, options: RemovalOptions = {}): Promise<RemovalResult> {
    const { onProgress, signal } = options

    onProgress?.(10, 'Connecting to Apple Silicon Core ML service')

    // Convert source to string data URL if Blob
    let sourceDataUrl: string
    if (typeof image === 'string') {
      sourceDataUrl = image
    } else if (image instanceof Blob) {
      sourceDataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(image)
      })
    } else {
      throw new Error('Unsupported ImageSource format for Core ML remover')
    }

    onProgress?.(30, 'Dispatching to Apple Neural Engine / Metal GPU')

    const response = await fetch(`${this.baseUrl}/remove`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: sourceDataUrl,
        feather: options.feather,
        threshold: options.threshold,
        model: options.model ?? 'birefnet',
      }),
      signal,
    })

    onProgress?.(80, 'Decoding alpha mask and cutout')

    if (!response.ok) {
      const errText = await response.text().catch(() => response.statusText)
      throw new Error(`Core ML removal failed (${response.status}): ${errText}`)
    }

    const data = await response.json()
    onProgress?.(100, 'Complete')

    return {
      image: data.image,
      mask: data.mask,
      source: image,
      metadata: {
        backendId: this.id,
        modelId: data.metadata?.modelId ?? 'birefnet-m2-coreml',
        executionTimeMs: data.metadata?.executionTimeMs,
      },
    }
  }
}
