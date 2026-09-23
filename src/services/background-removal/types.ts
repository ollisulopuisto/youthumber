export type ImageSource =
  | string // data URL or image URL
  | Blob
  | File
  | ImageData
  | ImageBitmap
  | HTMLImageElement
  | HTMLCanvasElement

export type RemovalProgressCallback = (progress: number, stage?: string) => void

export interface RemovalOptions {
  onProgress?: RemovalProgressCallback
  signal?: AbortSignal
  device?: 'auto' | 'cpu' | 'webgpu' | 'coreml'
  model?: string
  feather?: number
  threshold?: number
}

export interface RemovalMetadata {
  backendId: string
  modelId?: string
  executionTimeMs?: number
  cached?: boolean
  confidence?: number
}

export interface RemovalResult {
  image: string | Blob | HTMLCanvasElement | ImageBitmap
  mask: string | Blob | HTMLCanvasElement | ImageBitmap
  /** Mask that also keeps objects near the person (mic stand, chair), if the engine made one. */
  objectsMask?: string | null
  source?: ImageSource
  width?: number
  height?: number
  metadata?: RemovalMetadata
}

export interface BackgroundRemover {
  readonly id: string
  readonly name: string
  isAvailable(): Promise<boolean>
  remove(image: ImageSource, options?: RemovalOptions): Promise<RemovalResult>
}
