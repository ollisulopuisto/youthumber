export interface TransformState {
  x: number
  y: number
  scaleX: number
  scaleY: number
  rotation: number
  flipX?: boolean
}

export interface MaskRefinementOptions {
  feather: number // 0 to 20 px
  threshold: number // 0 to 255 (0 = off)
  opacity: number // 0 to 1
  invert?: boolean
}

export interface SpeakerState {
  id: 'speaker1' | 'speaker2'
  name: string
  sourceImageUrl: string | null
  sourceImageHash?: string
  maskUrl: string | null
  cutoutUrl: string | null
  isProcessing: boolean
  processingProgress: number
  processingStatus?: string
  error?: string | null
  visible: boolean
  transform: TransformState
  maskOptions?: MaskRefinementOptions
  removerId?: string
}

export interface BackgroundState {
  type: 'image' | 'solid'
  color: string
  imageUrl: string | null
  transform: {
    x: number
    y: number
    scaleX: number
    scaleY: number
  }
}

export interface TextLayerState {
  text: string
  fontFamily: string
  fontSize: number
  fontWeight: string | number
  fontStyle?: 'normal' | 'italic'
  textAlign: 'left' | 'center' | 'right'
  fillColor: string
  strokeColor?: string
  strokeWidth?: number
  shadowColor?: string
  shadowBlur?: number
  shadowOffsetX?: number
  shadowOffsetY?: number
  transform: TransformState
  visible: boolean
}

export type LayerId = 'background' | 'speaker1' | 'speaker2' | 'text'

export interface CanvasDimensions {
  width: 1280
  height: 720
}

export interface ThumbnailProject {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  version: number
  canvas: CanvasDimensions
  background: BackgroundState
  speaker1: SpeakerState
  speaker2: SpeakerState
  text: TextLayerState
  layerOrder: LayerId[]
}

export interface CompositionTemplate {
  id: string
  name: string
  description?: string
  backgroundTransform: { x: number; y: number; scaleX: number; scaleY: number }
  speaker1Transform: TransformState
  speaker2Transform: TransformState
  textStyleAndPosition: Omit<TextLayerState, 'text'> & { defaultText?: string }
}
