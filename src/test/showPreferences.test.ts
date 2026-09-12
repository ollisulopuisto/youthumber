import { describe, it, expect, beforeEach } from 'vitest'
import {
  DEFAULT_SHOW_PRESETS,
  loadShowPresets,
  saveShowPreset,
  deleteShowPreset,
  applyShowPresetToProject,
  createShowPresetFromProject,
} from '../modules/shows/showPreferences'
import { createDefaultProject, setSpeakerSource } from '../modules/thumbnail/thumbnailState'
import type { ShowPreferences } from '../types/showPreset'

describe('Per-Show Saved Preferences', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('provides default show presets', () => {
    const presets = loadShowPresets()
    expect(presets.length).toBeGreaterThanOrEqual(2)
    const dualShow = presets.find((p) => p.speakerCount === 2)
    const singleShow = presets.find((p) => p.speakerCount === 1)
    expect(dualShow).toBeDefined()
    expect(singleShow).toBeDefined()
  })

  it('saves and reloads custom show presets from localStorage', () => {
    const customShow: ShowPreferences = {
      id: 'show_tech_talk',
      name: 'Tech Talk Live',
      speakerCount: 1,
      background: {
        type: 'solid',
        color: '#0f172a',
      },
      text: {
        fontFamily: 'Bebas Neue',
        fontSize: 84,
        fontWeight: 'bold',
        textAlign: 'center',
        fillColor: '#F59E0B',
        strokeColor: '#000000',
        strokeWidth: 5,
        shadowColor: 'rgba(0,0,0,0.8)',
        shadowBlur: 14,
        shadowOffsetX: 3,
        shadowOffsetY: 5,
      },
    }

    saveShowPreset(customShow)
    const presets = loadShowPresets()
    const found = presets.find((p) => p.id === 'show_tech_talk')
    expect(found).toBeDefined()
    expect(found?.name).toBe('Tech Talk Live')
    expect(found?.text.fontFamily).toBe('Bebas Neue')
    expect(found?.text.fillColor).toBe('#F59E0B')
  })

  it('deletes custom show preset', () => {
    const customShow: ShowPreferences = {
      id: 'to_delete',
      name: 'Disposable Show',
      speakerCount: 2,
      background: { type: 'solid', color: '#000000' },
      text: {
        fontFamily: 'Montserrat',
        fontSize: 60,
        fontWeight: 'normal',
        textAlign: 'center',
        fillColor: '#FFFFFF',
      },
    }

    saveShowPreset(customShow)
    expect(loadShowPresets().some((p) => p.id === 'to_delete')).toBe(true)

    deleteShowPreset('to_delete')
    expect(loadShowPresets().some((p) => p.id === 'to_delete')).toBe(false)
  })

  it('applies show preset to project: configures speaker count, background, and typography', () => {
    let project = createDefaultProject('My Episode')
    project = setSpeakerSource(project, 'speaker1', 'photo1')
    project = setSpeakerSource(project, 'speaker2', 'photo2')

    const singleSpeakerShow: ShowPreferences = {
      id: 'solo_breakdown',
      name: 'Solo Breakdown',
      speakerCount: 1,
      background: {
        type: 'solid',
        color: '#1e1b4b',
      },
      text: {
        fontFamily: 'Impact',
        fontSize: 90,
        fontWeight: '900',
        textAlign: 'center',
        fillColor: '#38BDF8',
        strokeColor: '#000000',
        strokeWidth: 6,
      },
      speakerTransforms: {
        speaker1: { x: 640, y: 440, scale: 1.1, rotation: 0 },
      },
    }

    const applied = applyShowPresetToProject(project, singleSpeakerShow)

    // Speaker 1 is centered and visible, Speaker 2 is hidden
    expect(applied.speaker1.visible).toBe(true)
    expect(applied.speaker1.transform.x).toBe(640)
    expect(applied.speaker1.transform.scaleX).toBe(1.1)
    expect(applied.speaker2.visible).toBe(false)

    // Existing photos are preserved
    expect(applied.speaker1.sourceImageUrl).toBe('photo1')

    // Background and typography are updated
    expect(applied.background.color).toBe('#1e1b4b')
    expect(applied.text.fontFamily).toBe('Impact')
    expect(applied.text.fillColor).toBe('#38BDF8')
    expect(applied.text.fontSize).toBe(90)
  })

  it('creates new ShowPreferences from existing project configuration', () => {
    const project = createDefaultProject('Custom Live')
    project.speaker2.visible = false
    project.background.color = '#7c3aed'
    project.text.fontFamily = 'Anton'
    project.text.fillColor = '#22C55E'

    const preset = createShowPresetFromProject('Friday Live', project)

    expect(preset.name).toBe('Friday Live')
    expect(preset.speakerCount).toBe(1)
    expect(preset.background.color).toBe('#7c3aed')
    expect(preset.text.fontFamily).toBe('Anton')
    expect(preset.text.fillColor).toBe('#22C55E')
  })
})
