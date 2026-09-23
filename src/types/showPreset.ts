export interface ShowBackgroundPreference {
  type: 'solid' | 'image' | 'gradient'
  color: string
  imageUrl?: string | null
  gradient?: { colors: string[]; angle: number } | null
}

export interface ShowTextPreference {
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
  positionY?: number
}

export interface ShowSpeakerTransform {
  x: number
  y: number
  scale: number
  rotation: number
  flipX?: boolean
}

export interface ShowPreferences {
  id: string
  name: string
  speakerCount: 1 | 2
  background: ShowBackgroundPreference
  text: ShowTextPreference
  speakerTransforms?: {
    speaker1?: ShowSpeakerTransform
    speaker2?: ShowSpeakerTransform
  }
  defaultTitleTemplate?: string
  createdAt?: string
  updatedAt?: string
}
