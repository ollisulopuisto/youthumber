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
  /** Use the mask that also keeps objects (mic stand, chair), when the engine made one. */
  keepObjects?: boolean
}

export interface SpeakerState {
  /** Stable generated id (`spk_…`), also the speaker's canvas/layer id. Position = index in `speakers`. */
  id: string
  /** User-editable name shown next to the position label, e.g. "Left · Olli". */
  name: string
  sourceImageUrl: string | null
  sourceImageHash?: string
  maskUrl: string | null
  /** BiRefNet mask including objects around the person; null without the matting model. */
  objectsMaskUrl?: string | null
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

export interface BackgroundGradient {
  colors: string[]
  angle: number
  /** Missing on gradients saved before radial existed; treated as linear. */
  type?: 'linear' | 'radial'
}

export interface BackgroundState {
  type: 'image' | 'solid' | 'gradient'
  color: string
  imageUrl: string | null
  gradient: BackgroundGradient | null
  /** Photo blur in canvas pixels (0 = sharp). */
  imageBlur?: number
  /** Photo darkening, 0–1. */
  imageDarken?: number
  /** Edge darkening over any background, 0–1. */
  vignette?: number
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

/** 'background', 'text', or a speaker's id. */
export type LayerId = string

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
  /** 1–4 speakers, ordered left to right on the thumbnail. */
  speakers: SpeakerState[]
  layoutId: string
  text: TextLayerState
  layerOrder: LayerId[]
}

/** Where auto-frame aims a speaker's detected person: centre point and height, in canvas px. */
export interface SlotFrame {
  centerX: number
  centerY: number
  personHeight: number
}

export interface SlotLayout {
  /** Default placement when there's no cutout to auto-frame from. */
  transform: TransformState
  frame: SlotFrame
}

export interface LayoutPreset {
  id: string
  name: string
  description?: string
  speakerCount: number
  /** One per speaker, left to right. */
  slots: SlotLayout[]
  textStyleAndPosition: Omit<TextLayerState, 'text'> & { defaultText?: string }
}
