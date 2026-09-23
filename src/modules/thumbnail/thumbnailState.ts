import type {
  ThumbnailProject,
  SpeakerState,
  LayerId,
  LayoutPreset,
  MaskRefinementOptions,
  SlotFrame,
  TransformState,
} from '../../types/thumbnail'
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './canvasSize'
import { MAX_SPEAKERS, getDefaultLayout, getLayout, positionLabels } from './layouts'

export { CANVAS_WIDTH, CANVAS_HEIGHT }

export const PROJECT_VERSION = 2

const NON_SPEAKER_LAYERS = new Set(['background', 'text'])

export function isSpeakerLayer(layerId: LayerId): boolean {
  return !NON_SPEAKER_LAYERS.has(layerId)
}

export function newSpeakerId(): string {
  return `spk_${Math.random().toString(36).slice(2, 9)}`
}

/** Default names by position: Host, Guest, Guest 2, Guest 3. */
export function defaultSpeakerName(index: number): string {
  if (index === 0) return 'Host'
  if (index === 1) return 'Guest'
  return `Guest ${index}`
}

export function createDefaultSpeaker(name: string, id = newSpeakerId()): SpeakerState {
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
    transform: { x: CANVAS_WIDTH / 2, y: 420, scaleX: 1, scaleY: 1, rotation: 0, flipX: false },
    removerId: undefined,
  }
}

function clampCount(count: number): number {
  return Math.min(MAX_SPEAKERS, Math.max(1, Math.round(count)))
}

/** Puts each speaker at its slot's default transform for the given layout. */
function placeInSlots(speakers: SpeakerState[], layout: LayoutPreset): SpeakerState[] {
  return speakers.map((speaker, i) => ({
    ...speaker,
    transform: { ...layout.slots[i].transform },
  }))
}

export function createDefaultProject(name = 'Untitled Thumbnail', speakerCount = 2): ThumbnailProject {
  const now = new Date().toISOString()
  const count = clampCount(speakerCount)
  const layout = getDefaultLayout(count)
  const speakers = placeInSlots(
    Array.from({ length: count }, (_, i) => createDefaultSpeaker(defaultSpeakerName(i))),
    layout
  )

  return {
    id: `proj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name,
    createdAt: now,
    updatedAt: now,
    version: PROJECT_VERSION,
    canvas: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
    background: {
      type: 'solid',
      color: '#111827',
      imageUrl: null,
      gradient: null,
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1 },
    },
    speakers,
    layoutId: layout.id,
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
      transform: { x: 640, y: 110, scaleX: 1, scaleY: 1, rotation: 0 },
      visible: true,
    },
    layerOrder: ['background', ...speakers.map((s) => s.id), 'text'],
  }
}

export function getSpeaker(project: ThumbnailProject, speakerId: string): SpeakerState | undefined {
  return project.speakers.find((s) => s.id === speakerId)
}

/** The project's layout, falling back to the default for its speaker count. */
export function currentLayout(project: ThumbnailProject): LayoutPreset {
  const layout = getLayout(project.layoutId)
  return layout && layout.speakerCount === project.speakers.length
    ? layout
    : getDefaultLayout(project.speakers.length)
}

/** "Left · Olli": the speaker's position on the thumbnail plus their name. */
export function speakerLabel(project: ThumbnailProject, speakerId: string): string {
  const index = project.speakers.findIndex((s) => s.id === speakerId)
  if (index < 0) return ''
  const position = positionLabels(project.speakers.length)[index]
  const name = project.speakers[index].name.trim()
  return name ? `${position} · ${name}` : position
}

/** Where auto-frame should aim this speaker, given its position in the current layout. */
export function slotFrameFor(project: ThumbnailProject, speakerId: string): SlotFrame | undefined {
  const index = project.speakers.findIndex((s) => s.id === speakerId)
  if (index < 0) return undefined
  return currentLayout(project).slots[index]?.frame
}

function updateSpeaker(
  project: ThumbnailProject,
  speakerId: string,
  update: (speaker: SpeakerState) => SpeakerState,
  touch = true
): ThumbnailProject {
  return {
    ...project,
    ...(touch ? { updatedAt: new Date().toISOString() } : {}),
    speakers: project.speakers.map((s) => (s.id === speakerId ? update(s) : s)),
  }
}

export function setSpeakerSource(
  project: ThumbnailProject,
  speakerId: string,
  sourceUrl: string,
  hash?: string
): ThumbnailProject {
  return updateSpeaker(project, speakerId, (s) => ({
    ...s,
    sourceImageUrl: sourceUrl,
    sourceImageHash: hash,
    cutoutUrl: null,
    maskUrl: null,
    isProcessing: false,
    processingProgress: 0,
    error: null,
  }))
}

export function setSpeakerProcessing(
  project: ThumbnailProject,
  speakerId: string,
  isProcessing: boolean,
  progress = 0,
  status?: string,
  error?: string | null
): ThumbnailProject {
  return updateSpeaker(
    project,
    speakerId,
    (s) => ({
      ...s,
      isProcessing,
      processingProgress: progress,
      processingStatus: status,
      error: error ?? null,
    }),
    false
  )
}

export function setSpeakerCutout(
  project: ThumbnailProject,
  speakerId: string,
  cutoutUrl: string,
  maskUrl: string,
  removerId?: string
): ThumbnailProject {
  return updateSpeaker(project, speakerId, (s) => ({
    ...s,
    cutoutUrl,
    maskUrl,
    removerId,
    isProcessing: false,
    processingProgress: 100,
    error: null,
  }))
}

export function updateSpeakerTransform(
  project: ThumbnailProject,
  speakerId: string,
  transform: Partial<TransformState>
): ThumbnailProject {
  return updateSpeaker(project, speakerId, (s) => ({
    ...s,
    transform: { ...s.transform, ...transform },
  }))
}

export function updateSpeakerMaskOptions(
  project: ThumbnailProject,
  speakerId: string,
  maskOptions: Partial<MaskRefinementOptions>
): ThumbnailProject {
  return updateSpeaker(project, speakerId, (s) => ({
    ...s,
    maskOptions: {
      feather: 0,
      threshold: 0,
      opacity: 1,
      invert: false,
      ...(s.maskOptions || {}),
      ...maskOptions,
    },
  }))
}

export function toggleSpeakerVisibility(project: ThumbnailProject, speakerId: string): ThumbnailProject {
  return updateSpeaker(project, speakerId, (s) => ({ ...s, visible: !s.visible }))
}

export function renameSpeaker(project: ThumbnailProject, speakerId: string, name: string): ThumbnailProject {
  return updateSpeaker(project, speakerId, (s) => ({ ...s, name }))
}

/** Removes a speaker's photo and cutout; the speaker slot itself stays. */
export function clearSpeakerImage(project: ThumbnailProject, speakerId: string): ThumbnailProject {
  return updateSpeaker(project, speakerId, (s) => ({
    ...s,
    sourceImageUrl: null,
    sourceImageHash: undefined,
    maskUrl: null,
    cutoutUrl: null,
    isProcessing: false,
    processingProgress: 0,
    error: null,
  }))
}

/**
 * Changes the number of speakers (clamped to 1–4). Speakers are added or dropped on
 * the right; the rest keep their photos. Switches to that count's default layout and
 * places everyone at its slots — the caller re-runs auto-frame for speakers with cutouts.
 * The headline style is left alone.
 */
export function setSpeakerCount(project: ThumbnailProject, count: number): ThumbnailProject {
  const target = clampCount(count)
  const current = project.speakers
  if (target === current.length) return project

  const kept = current.slice(0, target)
  const added = Array.from({ length: target - kept.length }, (_, i) =>
    createDefaultSpeaker(defaultSpeakerName(kept.length + i))
  )
  const layout = getDefaultLayout(target)
  const speakers = placeInSlots([...kept, ...added], layout)

  const removedIds = new Set(current.slice(target).map((s) => s.id))
  let layerOrder = project.layerOrder.filter((id) => !removedIds.has(id))
  if (added.length) {
    const textIndex = layerOrder.indexOf('text')
    const insertAt = textIndex >= 0 ? textIndex : layerOrder.length
    layerOrder = [
      ...layerOrder.slice(0, insertAt),
      ...added.map((s) => s.id),
      ...layerOrder.slice(insertAt),
    ]
  }

  return {
    ...project,
    updatedAt: new Date().toISOString(),
    speakers,
    layoutId: layout.id,
    layerOrder,
  }
}

/**
 * Swaps a speaker with its left (-1) or right (+1) neighbour and puts both at their new
 * slots' default transforms — the caller re-runs auto-frame for speakers with cutouts.
 */
export function moveSpeaker(project: ThumbnailProject, speakerId: string, delta: -1 | 1): ThumbnailProject {
  const from = project.speakers.findIndex((s) => s.id === speakerId)
  const to = from + delta
  if (from < 0 || to < 0 || to >= project.speakers.length) return project

  const speakers = [...project.speakers]
  ;[speakers[from], speakers[to]] = [speakers[to], speakers[from]]
  const layout = currentLayout(project)
  speakers[from] = { ...speakers[from], transform: { ...layout.slots[from].transform } }
  speakers[to] = { ...speakers[to], transform: { ...layout.slots[to].transform } }

  return { ...project, updatedAt: new Date().toISOString(), speakers }
}

/** Applies a layout chosen by the user: slot positions plus headline style. */
export function applyLayout(project: ThumbnailProject, layout: LayoutPreset): ThumbnailProject {
  if (layout.speakerCount !== project.speakers.length) return project
  const style = layout.textStyleAndPosition

  return {
    ...project,
    updatedAt: new Date().toISOString(),
    layoutId: layout.id,
    speakers: placeInSlots(project.speakers, layout),
    text: {
      ...project.text,
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      fontStyle: style.fontStyle,
      textAlign: style.textAlign,
      fillColor: style.fillColor,
      strokeColor: style.strokeColor,
      strokeWidth: style.strokeWidth,
      shadowColor: style.shadowColor,
      shadowBlur: style.shadowBlur,
      shadowOffsetX: style.shadowOffsetX,
      shadowOffsetY: style.shadowOffsetY,
      transform: { ...style.transform },
      visible: style.visible,
    },
  }
}

export function setBackgroundImage(project: ThumbnailProject, imageUrl: string): ThumbnailProject {
  return {
    ...project,
    updatedAt: new Date().toISOString(),
    background: { ...project.background, type: 'image', imageUrl },
  }
}

export function setBackgroundColor(project: ThumbnailProject, color: string): ThumbnailProject {
  return {
    ...project,
    updatedAt: new Date().toISOString(),
    background: { ...project.background, type: 'solid', color },
  }
}

export function setBackgroundGradient(
  project: ThumbnailProject,
  gradient: { colors: string[]; angle: number }
): ThumbnailProject {
  return {
    ...project,
    updatedAt: new Date().toISOString(),
    background: { ...project.background, type: 'gradient', gradient },
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
      transform: { ...project.text.transform, ...(updates.transform || {}) },
    },
  }
}

export function reorderLayers(project: ThumbnailProject, newOrder: LayerId[]): ThumbnailProject {
  return { ...project, updatedAt: new Date().toISOString(), layerOrder: [...newOrder] }
}
