import type {
  ThumbnailProject,
  SpeakerState,
  CompositionTemplate,
  LayerId,
  TransformState,
} from '../../types/thumbnail'

export const CANVAS_WIDTH = 1280
export const CANVAS_HEIGHT = 720

export function createDefaultSpeaker(
  id: 'speaker1' | 'speaker2',
  name: string,
  defaultX: number,
  defaultY: number
): SpeakerState {
  return {
    id,
    name,
    sourceImageUrl: null,
    sourceImageHash: undefined,
    maskUrl: null,
    cutoutUrl: null,
    isProcessing: false,
    processingProgress: 0,
    processingStatus: undefined,
    error: null,
    visible: true,
    transform: {
      x: defaultX,
      y: defaultY,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      flipX: false,
    },
    removerId: undefined,
  }
}

export function createDefaultProject(name = 'Untitled Thumbnail'): ThumbnailProject {
  const now = new Date().toISOString()
  return {
    id: `proj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name,
    createdAt: now,
    updatedAt: now,
    version: 1,
    canvas: {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
    },
    background: {
      type: 'solid',
      color: '#111827', // dark slate
      imageUrl: null,
      gradient: null,
      transform: {
        x: 0,
        y: 0,
        scaleX: 1,
        scaleY: 1,
      },
    },
    speaker1: createDefaultSpeaker('speaker1', 'Speaker 1', 350, 420),
    speaker2: createDefaultSpeaker('speaker2', 'Speaker 2', 930, 420),
    text: {
      text: 'EPISODE TITLE GOES HERE',
      fontFamily: 'Montserrat',
      fontSize: 64,
      fontWeight: 'bold',
      fontStyle: 'normal',
      textAlign: 'center',
      fillColor: '#FFFFFF',
      strokeColor: '#000000',
      strokeWidth: 4,
      shadowColor: 'rgba(0, 0, 0, 0.75)',
      shadowBlur: 12,
      shadowOffsetX: 3,
      shadowOffsetY: 5,
      transform: {
        x: 640,
        y: 110,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
      },
      visible: true,
    },
    layerOrder: ['background', 'speaker1', 'speaker2', 'text'],
  }
}

export function setSpeakerSource(
  project: ThumbnailProject,
  speakerId: 'speaker1' | 'speaker2',
  sourceUrl: string,
  hash?: string
): ThumbnailProject {
  return {
    ...project,
    updatedAt: new Date().toISOString(),
    [speakerId]: {
      ...project[speakerId],
      sourceImageUrl: sourceUrl,
      sourceImageHash: hash,
      cutoutUrl: null,
      maskUrl: null,
      isProcessing: false,
      processingProgress: 0,
      error: null,
    },
  }
}

export function setSpeakerProcessing(
  project: ThumbnailProject,
  speakerId: 'speaker1' | 'speaker2',
  isProcessing: boolean,
  progress = 0,
  status?: string,
  error?: string | null
): ThumbnailProject {
  return {
    ...project,
    [speakerId]: {
      ...project[speakerId],
      isProcessing,
      processingProgress: progress,
      processingStatus: status,
      error: error ?? null,
    },
  }
}

export function setSpeakerCutout(
  project: ThumbnailProject,
  speakerId: 'speaker1' | 'speaker2',
  cutoutUrl: string,
  maskUrl: string,
  removerId?: string
): ThumbnailProject {
  return {
    ...project,
    updatedAt: new Date().toISOString(),
    [speakerId]: {
      ...project[speakerId],
      cutoutUrl,
      maskUrl,
      removerId,
      isProcessing: false,
      processingProgress: 100,
      error: null,
    },
  }
}

export function updateSpeakerTransform(
  project: ThumbnailProject,
  speakerId: 'speaker1' | 'speaker2',
  transform: Partial<TransformState>
): ThumbnailProject {
  return {
    ...project,
    updatedAt: new Date().toISOString(),
    [speakerId]: {
      ...project[speakerId],
      transform: {
        ...project[speakerId].transform,
        ...transform,
      },
    },
  }
}

export function updateSpeakerMaskOptions(
  project: ThumbnailProject,
  speakerId: 'speaker1' | 'speaker2',
  maskOptions: Partial<import('../../types/thumbnail').MaskRefinementOptions>
): ThumbnailProject {
  return {
    ...project,
    updatedAt: new Date().toISOString(),
    [speakerId]: {
      ...project[speakerId],
      maskOptions: {
        feather: 0,
        threshold: 0,
        opacity: 1,
        invert: false,
        ...(project[speakerId].maskOptions || {}),
        ...maskOptions,
      },
    },
  }
}

export function toggleSpeakerVisibility(
  project: ThumbnailProject,
  speakerId: 'speaker1' | 'speaker2'
): ThumbnailProject {
  return {
    ...project,
    updatedAt: new Date().toISOString(),
    [speakerId]: {
      ...project[speakerId],
      visible: !project[speakerId].visible,
    },
  }
}

export function removeSpeaker(
  project: ThumbnailProject,
  speakerId: 'speaker1' | 'speaker2'
): ThumbnailProject {
  return {
    ...project,
    updatedAt: new Date().toISOString(),
    [speakerId]: {
      ...project[speakerId],
      sourceImageUrl: null,
      sourceImageHash: undefined,
      maskUrl: null,
      cutoutUrl: null,
      isProcessing: false,
      processingProgress: 0,
      error: null,
    },
  }
}

export function setBackgroundImage(project: ThumbnailProject, imageUrl: string): ThumbnailProject {
  return {
    ...project,
    updatedAt: new Date().toISOString(),
    background: {
      ...project.background,
      type: 'image',
      imageUrl,
    },
  }
}

export function setBackgroundColor(project: ThumbnailProject, color: string): ThumbnailProject {
  return {
    ...project,
    updatedAt: new Date().toISOString(),
    background: {
      ...project.background,
      type: 'solid',
      color,
    },
  }
}

export function setBackgroundGradient(
  project: ThumbnailProject,
  gradient: { colors: string[]; angle: number }
): ThumbnailProject {
  return {
    ...project,
    updatedAt: new Date().toISOString(),
    background: {
      ...project.background,
      type: 'gradient',
      gradient,
    },
  }
}

export function updateTextLayer(
  project: ThumbnailProject,
  updates: Partial<ThumbnailProject['text']>
): ThumbnailProject {
  return {
    ...project,
    updatedAt: new Date().toISOString(),
    text: {
      ...project.text,
      ...updates,
      transform: {
        ...project.text.transform,
        ...(updates.transform || {}),
      },
    },
  }
}

export function reorderLayers(project: ThumbnailProject, newOrder: LayerId[]): ThumbnailProject {
  return {
    ...project,
    updatedAt: new Date().toISOString(),
    layerOrder: [...newOrder],
  }
}

export function applyTemplateToProject(
  project: ThumbnailProject,
  template: CompositionTemplate
): ThumbnailProject {
  return {
    ...project,
    updatedAt: new Date().toISOString(),
    background: {
      ...project.background,
      transform: { ...template.backgroundTransform },
    },
    speaker1: {
      ...project.speaker1,
      transform: { ...template.speaker1Transform },
    },
    speaker2: {
      ...project.speaker2,
      transform: { ...template.speaker2Transform },
    },
    text: {
      ...project.text,
      fontFamily: template.textStyleAndPosition.fontFamily,
      fontSize: template.textStyleAndPosition.fontSize,
      fontWeight: template.textStyleAndPosition.fontWeight,
      fontStyle: template.textStyleAndPosition.fontStyle,
      textAlign: template.textStyleAndPosition.textAlign,
      fillColor: template.textStyleAndPosition.fillColor,
      strokeColor: template.textStyleAndPosition.strokeColor,
      strokeWidth: template.textStyleAndPosition.strokeWidth,
      shadowColor: template.textStyleAndPosition.shadowColor,
      shadowBlur: template.textStyleAndPosition.shadowBlur,
      shadowOffsetX: template.textStyleAndPosition.shadowOffsetX,
      shadowOffsetY: template.textStyleAndPosition.shadowOffsetY,
      transform: { ...template.textStyleAndPosition.transform },
      visible: template.textStyleAndPosition.visible,
    },
  }
}
