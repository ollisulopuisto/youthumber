import { describe, it, expect, beforeEach } from 'vitest'
import {
  loadShowPresets,
  saveShowPreset,
  deleteShowPreset,
  applyShowPresetToProject,
  createShowPresetFromProject,
} from '../modules/shows/showPreferences'
import {
  createDefaultProject,
  renameSpeaker,
  setSpeakerSource,
} from '../modules/thumbnail/thumbnailState'
import type { ShowPreferences } from '../types/showPreset'

const TEXT: ShowPreferences['text'] = {
  fontFamily: 'Impact',
  fontSize: 90,
  fontWeight: '900',
  textAlign: 'center',
  fillColor: '#38BDF8',
  strokeColor: '#000000',
  strokeWidth: 6,
}

describe('Per-Show Saved Preferences', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('provides default show presets for one and two speakers', () => {
    const presets = loadShowPresets()
    expect(presets.some((p) => p.speakerCount === 1)).toBe(true)
    expect(presets.some((p) => p.speakerCount === 2)).toBe(true)
  })

  it('saves, reloads and deletes custom show presets', () => {
    const show: ShowPreferences = {
      id: 'show_tech_talk',
      name: 'Tech Talk Live',
      speakerCount: 3,
      background: { type: 'solid', color: '#0f172a' },
      text: TEXT,
      speakerNames: ['Olli', 'Anna', 'Pekka'],
    }

    saveShowPreset(show)
    const found = loadShowPresets().find((p) => p.id === 'show_tech_talk')
    expect(found?.speakerNames).toEqual(['Olli', 'Anna', 'Pekka'])

    deleteShowPreset('show_tech_talk')
    expect(loadShowPresets().some((p) => p.id === 'show_tech_talk')).toBe(false)
  })

  it('migrates stored v1 presets with speaker1/speaker2 transforms', () => {
    localStorage.setItem(
      'yt_thumb_show_presets',
      JSON.stringify([
        {
          id: 'old_show',
          name: 'Old Show',
          speakerCount: 2,
          background: { type: 'solid', color: '#000' },
          text: TEXT,
          speakerTransforms: {
            speaker1: { x: 300, y: 440, scale: 0.9, rotation: 0 },
            speaker2: { x: 980, y: 440, scale: 0.9, rotation: 0 },
          },
        },
      ])
    )

    const old = loadShowPresets().find((p) => p.id === 'old_show')

    expect(old?.speakerTransforms).toEqual([
      { x: 300, y: 440, scale: 0.9, rotation: 0 },
      { x: 980, y: 440, scale: 0.9, rotation: 0 },
    ])
  })

  it('applies a show preset: speaker count, names, placement, background and typography', () => {
    let project = createDefaultProject('My Episode')
    project = setSpeakerSource(project, project.speakers[0].id, 'photo1')

    const show: ShowPreferences = {
      id: 'panel',
      name: 'Panel',
      speakerCount: 3,
      background: { type: 'solid', color: '#1e1b4b' },
      text: TEXT,
      speakerNames: ['Olli', 'Anna', 'Pekka'],
      speakerTransforms: [{ x: 200, y: 440, scale: 0.7, rotation: 0 }],
    }

    const applied = applyShowPresetToProject(project, show)

    expect(applied.speakers.map((s) => s.name)).toEqual(['Olli', 'Anna', 'Pekka'])
    expect(applied.speakers[0].sourceImageUrl).toBe('photo1')
    expect(applied.speakers[0].transform).toMatchObject({ x: 200, scaleX: 0.7, scaleY: 0.7 })
    expect(applied.background.color).toBe('#1e1b4b')
    expect(applied.text.fontFamily).toBe('Impact')
  })

  it('applying a one-speaker show drops the other speakers', () => {
    const show: ShowPreferences = {
      id: 'solo',
      name: 'Solo',
      speakerCount: 1,
      background: { type: 'solid', color: '#000' },
      text: TEXT,
    }

    expect(applyShowPresetToProject(createDefaultProject(), show).speakers).toHaveLength(1)
  })

  it('round-trips photo blur, darken and vignette through a show preset', () => {
    const project = createDefaultProject('Styled')
    project.background = {
      ...project.background,
      type: 'image',
      imageUrl: 'data:image/jpeg;base64,studio',
      imageBlur: 16,
      imageDarken: 0.35,
      vignette: 0.5,
    }

    const preset = createShowPresetFromProject('Studio look', project)
    const applied = applyShowPresetToProject(createDefaultProject('Next episode'), preset)

    expect(applied.background).toMatchObject({ imageBlur: 16, imageDarken: 0.35, vignette: 0.5 })
  })

  it('creates a show preset from a project, including count and names', () => {
    let project = createDefaultProject('Custom Live', 3)
    project = renameSpeaker(project, project.speakers[0].id, 'Olli')
    project = { ...project, text: { ...project.text, fontFamily: 'Anton' } }

    const preset = createShowPresetFromProject('Friday Live', project)

    expect(preset.speakerCount).toBe(3)
    expect(preset.speakerNames).toEqual(['Olli', 'Guest', 'Guest 2'])
    expect(preset.speakerTransforms).toHaveLength(3)
    expect(preset.text.fontFamily).toBe('Anton')
  })
})
