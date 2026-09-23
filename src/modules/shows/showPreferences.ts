import type { ShowPreferences, ShowSpeakerTransform } from '../../types/showPreset'
import type { ThumbnailProject } from '../../types/thumbnail'
import { setSpeakerCount } from '../thumbnail/thumbnailState'

const SHOW_PRESETS_STORAGE_KEY = 'yt_thumb_show_presets'

export const DEFAULT_SHOW_PRESETS: ShowPreferences[] = [
  {
    id: 'preset_dual_debate',
    name: 'Dual Speaker Debate',
    speakerCount: 2,
    background: { type: 'solid', color: '#0f172a' },
    text: {
      fontFamily: 'Montserrat',
      fontSize: 68,
      fontWeight: '900',
      textAlign: 'center',
      fillColor: '#FACC15',
      strokeColor: '#000000',
      strokeWidth: 6,
      shadowColor: 'rgba(0,0,0,0.9)',
      shadowBlur: 16,
      shadowOffsetX: 4,
      shadowOffsetY: 6,
    },
    speakerTransforms: [
      { x: 320, y: 440, scale: 0.9, rotation: 0 },
      { x: 960, y: 440, scale: 0.9, rotation: 0 },
    ],
  },
  {
    id: 'preset_solo_breakdown',
    name: 'Solo Deep Dive',
    speakerCount: 1,
    background: { type: 'solid', color: '#1e1b4b' },
    text: {
      fontFamily: 'Bebas Neue',
      fontSize: 84,
      fontWeight: 'bold',
      textAlign: 'center',
      fillColor: '#FFFFFF',
      strokeColor: '#DC2626',
      strokeWidth: 5,
      shadowColor: 'rgba(0,0,0,0.85)',
      shadowBlur: 14,
      shadowOffsetX: 3,
      shadowOffsetY: 5,
    },
    speakerTransforms: [{ x: 640, y: 430, scale: 1.1, rotation: 0 }],
  },
  {
    id: 'preset_interview_spotlight',
    name: 'Interview Spotlight',
    speakerCount: 2,
    background: { type: 'solid', color: '#18181b' },
    text: {
      fontFamily: 'Impact',
      fontSize: 76,
      fontWeight: 'bold',
      textAlign: 'center',
      fillColor: '#38BDF8',
      strokeColor: '#0F172A',
      strokeWidth: 6,
      shadowColor: 'rgba(0,0,0,0.9)',
      shadowBlur: 20,
      shadowOffsetX: 4,
      shadowOffsetY: 8,
    },
    speakerTransforms: [
      { x: 260, y: 460, scale: 0.8, rotation: -3 },
      { x: 980, y: 410, scale: 1.05, rotation: 2 },
    ],
  },
]

/** v1 stored transforms as `{ speaker1, speaker2 }`; v2 uses a left-to-right array. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function migrateShowPreset(raw: any): ShowPreferences {
  const transforms = raw.speakerTransforms
  if (!transforms || Array.isArray(transforms)) return raw as ShowPreferences
  return {
    ...raw,
    speakerTransforms: [transforms.speaker1, transforms.speaker2].filter(
      Boolean
    ) as ShowSpeakerTransform[],
  }
}

function readCustomPresets(): ShowPreferences[] {
  const raw = localStorage.getItem(SHOW_PRESETS_STORAGE_KEY)
  return raw ? (JSON.parse(raw) as unknown[]).map(migrateShowPreset) : []
}

export function loadShowPresets(): ShowPreferences[] {
  try {
    return [...readCustomPresets(), ...DEFAULT_SHOW_PRESETS]
  } catch {
    return [...DEFAULT_SHOW_PRESETS]
  }
}

export function saveShowPreset(preset: ShowPreferences): void {
  try {
    const updated = readCustomPresets().filter((p) => p.id !== preset.id)
    updated.unshift({ ...preset, updatedAt: new Date().toISOString() })
    localStorage.setItem(SHOW_PRESETS_STORAGE_KEY, JSON.stringify(updated))
  } catch (err) {
    console.error('Failed to save show preset to localStorage', err)
  }
}

export function deleteShowPreset(id: string): void {
  try {
    const updated = readCustomPresets().filter((p) => p.id !== id)
    localStorage.setItem(SHOW_PRESETS_STORAGE_KEY, JSON.stringify(updated))
  } catch (err) {
    console.error('Failed to delete show preset from localStorage', err)
  }
}

export function applyShowPresetToProject(
  project: ThumbnailProject,
  preset: ShowPreferences
): ThumbnailProject {
  const resized = setSpeakerCount(project, preset.speakerCount)

  return {
    ...resized,
    updatedAt: new Date().toISOString(),
    background: {
      ...resized.background,
      type: preset.background.type || 'solid',
      color: preset.background.color || resized.background.color,
      imageUrl: preset.background.imageUrl ?? resized.background.imageUrl,
      gradient: preset.background.gradient ?? resized.background.gradient,
      imageBlur: preset.background.imageBlur ?? resized.background.imageBlur,
      imageDarken: preset.background.imageDarken ?? resized.background.imageDarken,
      vignette: preset.background.vignette ?? resized.background.vignette,
    },
    speakers: resized.speakers.map((speaker, i) => {
      const t = preset.speakerTransforms?.[i]
      return {
        ...speaker,
        visible: true,
        name: preset.speakerNames?.[i] || speaker.name,
        transform: t
          ? {
              ...speaker.transform,
              x: t.x,
              y: t.y,
              scaleX: t.scale,
              scaleY: t.scale,
              rotation: t.rotation,
              flipX: t.flipX ?? speaker.transform.flipX,
            }
          : speaker.transform,
      }
    }),
    text: {
      ...resized.text,
      fontFamily: preset.text.fontFamily,
      fontSize: preset.text.fontSize,
      fontWeight: preset.text.fontWeight,
      textAlign: preset.text.textAlign,
      fillColor: preset.text.fillColor,
      strokeColor: preset.text.strokeColor ?? resized.text.strokeColor,
      strokeWidth: preset.text.strokeWidth ?? resized.text.strokeWidth,
      shadowColor: preset.text.shadowColor ?? resized.text.shadowColor,
      shadowBlur: preset.text.shadowBlur ?? resized.text.shadowBlur,
      shadowOffsetX: preset.text.shadowOffsetX ?? resized.text.shadowOffsetX,
      shadowOffsetY: preset.text.shadowOffsetY ?? resized.text.shadowOffsetY,
    },
  }
}

export function createShowPresetFromProject(
  name: string,
  project: ThumbnailProject
): ShowPreferences {
  const now = new Date().toISOString()
  return {
    id: `show_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    speakerCount: project.speakers.length,
    background: {
      type: project.background.type,
      color: project.background.color,
      imageUrl: project.background.imageUrl,
      gradient: project.background.gradient,
      imageBlur: project.background.imageBlur,
      imageDarken: project.background.imageDarken,
      vignette: project.background.vignette,
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
    speakerTransforms: project.speakers.map((s) => ({
      x: s.transform.x,
      y: s.transform.y,
      scale: s.transform.scaleX,
      rotation: s.transform.rotation,
      flipX: s.transform.flipX,
    })),
    speakerNames: project.speakers.map((s) => s.name),
    createdAt: now,
    updatedAt: now,
  }
}
