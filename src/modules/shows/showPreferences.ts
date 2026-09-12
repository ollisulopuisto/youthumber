import type { ShowPreferences } from '../../types/showPreset'
import type { ThumbnailProject } from '../../types/thumbnail'

const SHOW_PRESETS_STORAGE_KEY = 'yt_thumb_show_presets'

export const DEFAULT_SHOW_PRESETS: ShowPreferences[] = [
  {
    id: 'preset_dual_debate',
    name: 'Dual Speaker Debate',
    speakerCount: 2,
    background: {
      type: 'solid',
      color: '#0f172a', // dark slate
    },
    text: {
      fontFamily: 'Montserrat',
      fontSize: 68,
      fontWeight: '900',
      textAlign: 'center',
      fillColor: '#FACC15', // Gold
      strokeColor: '#000000',
      strokeWidth: 6,
      shadowColor: 'rgba(0,0,0,0.9)',
      shadowBlur: 16,
      shadowOffsetX: 4,
      shadowOffsetY: 6,
    },
    speakerTransforms: {
      speaker1: { x: 320, y: 440, scale: 0.9, rotation: 0 },
      speaker2: { x: 960, y: 440, scale: 0.9, rotation: 0 },
    },
  },
  {
    id: 'preset_solo_breakdown',
    name: 'Solo Deep Dive',
    speakerCount: 1,
    background: {
      type: 'solid',
      color: '#1e1b4b', // deep indigo
    },
    text: {
      fontFamily: 'Bebas Neue',
      fontSize: 84,
      fontWeight: 'bold',
      textAlign: 'center',
      fillColor: '#FFFFFF',
      strokeColor: '#DC2626', // Red outline
      strokeWidth: 5,
      shadowColor: 'rgba(0,0,0,0.85)',
      shadowBlur: 14,
      shadowOffsetX: 3,
      shadowOffsetY: 5,
    },
    speakerTransforms: {
      speaker1: { x: 640, y: 430, scale: 1.1, rotation: 0 },
    },
  },
  {
    id: 'preset_interview_spotlight',
    name: 'Interview Spotlight',
    speakerCount: 2,
    background: {
      type: 'solid',
      color: '#18181b', // dark zinc
    },
    text: {
      fontFamily: 'Impact',
      fontSize: 76,
      fontWeight: 'bold',
      textAlign: 'center',
      fillColor: '#38BDF8', // Cyan
      strokeColor: '#0F172A',
      strokeWidth: 6,
      shadowColor: 'rgba(0,0,0,0.9)',
      shadowBlur: 20,
      shadowOffsetX: 4,
      shadowOffsetY: 8,
    },
    speakerTransforms: {
      speaker1: { x: 260, y: 460, scale: 0.8, rotation: -3 },
      speaker2: { x: 980, y: 410, scale: 1.05, rotation: 2 },
    },
  },
]

export function loadShowPresets(): ShowPreferences[] {
  try {
    const raw = localStorage.getItem(SHOW_PRESETS_STORAGE_KEY)
    if (!raw) return [...DEFAULT_SHOW_PRESETS]
    const customList = JSON.parse(raw) as ShowPreferences[]
    return [...customList, ...DEFAULT_SHOW_PRESETS]
  } catch {
    return [...DEFAULT_SHOW_PRESETS]
  }
}

export function saveShowPreset(preset: ShowPreferences): void {
  try {
    const raw = localStorage.getItem(SHOW_PRESETS_STORAGE_KEY)
    const currentList: ShowPreferences[] = raw ? JSON.parse(raw) : []
    const updated = currentList.filter((p) => p.id !== preset.id)
    updated.unshift({
      ...preset,
      updatedAt: new Date().toISOString(),
    })
    localStorage.setItem(SHOW_PRESETS_STORAGE_KEY, JSON.stringify(updated))
  } catch (err) {
    console.error('Failed to save show preset to localStorage', err)
  }
}

export function deleteShowPreset(id: string): void {
  try {
    const raw = localStorage.getItem(SHOW_PRESETS_STORAGE_KEY)
    if (!raw) return
    const currentList: ShowPreferences[] = JSON.parse(raw)
    const updated = currentList.filter((p) => p.id !== id)
    localStorage.setItem(SHOW_PRESETS_STORAGE_KEY, JSON.stringify(updated))
  } catch (err) {
    console.error('Failed to delete show preset from localStorage', err)
  }
}

export function applyShowPresetToProject(
  project: ThumbnailProject,
  preset: ShowPreferences
): ThumbnailProject {
  const isSingle = preset.speakerCount === 1

  const s1Transform = preset.speakerTransforms?.speaker1
  const s2Transform = preset.speakerTransforms?.speaker2

  return {
    ...project,
    updatedAt: new Date().toISOString(),
    background: {
      ...project.background,
      type: preset.background.type || 'solid',
      color: preset.background.color || project.background.color,
      imageUrl: preset.background.imageUrl ?? project.background.imageUrl,
    },
    speaker1: {
      ...project.speaker1,
      visible: true,
      transform: {
        ...project.speaker1.transform,
        x: s1Transform?.x ?? (isSingle ? 640 : 350),
        y: s1Transform?.y ?? 420,
        scaleX: s1Transform?.scale ?? (isSingle ? 1.05 : 0.9),
        scaleY: s1Transform?.scale ?? (isSingle ? 1.05 : 0.9),
        rotation: s1Transform?.rotation ?? 0,
      },
    },
    speaker2: {
      ...project.speaker2,
      visible: !isSingle,
      transform: {
        ...project.speaker2.transform,
        x: s2Transform?.x ?? 930,
        y: s2Transform?.y ?? 420,
        scaleX: s2Transform?.scale ?? 0.9,
        scaleY: s2Transform?.scale ?? 0.9,
        rotation: s2Transform?.rotation ?? 0,
      },
    },
    text: {
      ...project.text,
      fontFamily: preset.text.fontFamily,
      fontSize: preset.text.fontSize,
      fontWeight: preset.text.fontWeight,
      textAlign: preset.text.textAlign,
      fillColor: preset.text.fillColor,
      strokeColor: preset.text.strokeColor ?? project.text.strokeColor,
      strokeWidth: preset.text.strokeWidth ?? project.text.strokeWidth,
      shadowColor: preset.text.shadowColor ?? project.text.shadowColor,
      shadowBlur: preset.text.shadowBlur ?? project.text.shadowBlur,
      shadowOffsetX: preset.text.shadowOffsetX ?? project.text.shadowOffsetX,
      shadowOffsetY: preset.text.shadowOffsetY ?? project.text.shadowOffsetY,
    },
  }
}

export function createShowPresetFromProject(
  name: string,
  project: ThumbnailProject
): ShowPreferences {
  const speakerCount: 1 | 2 = !project.speaker2.visible ? 1 : 2

  return {
    id: `show_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    speakerCount,
    background: {
      type: project.background.type,
      color: project.background.color,
      imageUrl: project.background.imageUrl,
    },
    text: {
      fontFamily: project.text.fontFamily,
      fontSize: project.text.fontSize,
      fontWeight: project.text.fontWeight,
      fontStyle: project.text.fontStyle,
      textAlign: project.text.textAlign,
      fillColor: project.text.fillColor,
      strokeColor: project.text.strokeColor,
      strokeWidth: project.text.strokeWidth,
      shadowColor: project.text.shadowColor,
      shadowBlur: project.text.shadowBlur,
      shadowOffsetX: project.text.shadowOffsetX,
      shadowOffsetY: project.text.shadowOffsetY,
    },
    speakerTransforms: {
      speaker1: {
        x: project.speaker1.transform.x,
        y: project.speaker1.transform.y,
        scale: project.speaker1.transform.scaleX,
        rotation: project.speaker1.transform.rotation,
        flipX: project.speaker1.transform.flipX,
      },
      speaker2: {
        x: project.speaker2.transform.x,
        y: project.speaker2.transform.y,
        scale: project.speaker2.transform.scaleX,
        rotation: project.speaker2.transform.rotation,
        flipX: project.speaker2.transform.flipX,
      },
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}
