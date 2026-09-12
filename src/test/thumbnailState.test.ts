import { describe, it, expect } from 'vitest'
import {
  createDefaultProject,
  setSpeakerSource,
  setSpeakerCutout,
  updateSpeakerTransform,
  toggleSpeakerVisibility,
  removeSpeaker,
  reorderLayers,
  applyTemplateToProject,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
} from '../modules/thumbnail/thumbnailState'
import type { CompositionTemplate } from '../types/thumbnail'

describe('Thumbnail State Management', () => {
  it('creates default project with 1280x720 canvas and standard layer order', () => {
    const project = createDefaultProject('My Thumbnail')

    expect(project.canvas.width).toBe(CANVAS_WIDTH)
    expect(project.canvas.height).toBe(CANVAS_HEIGHT)
    expect(project.canvas.width).toBe(1280)
    expect(project.canvas.height).toBe(720)
    expect(project.layerOrder).toEqual(['background', 'speaker1', 'speaker2', 'text'])
    expect(project.speaker1.visible).toBe(true)
    expect(project.speaker2.visible).toBe(true)
  })

  it('updates speaker source image and resets cutout until processed', () => {
    const project = createDefaultProject()
    const updated = setSpeakerSource(project, 'speaker1', 'data:image/jpeg;base64,source1')

    expect(updated.speaker1.sourceImageUrl).toBe('data:image/jpeg;base64,source1')
    expect(updated.speaker1.cutoutUrl).toBeNull()
    expect(updated.speaker1.maskUrl).toBeNull()
  })

  it('sets speaker mask and cutout once background removal completes', () => {
    const project = createDefaultProject()
    const withSource = setSpeakerSource(project, 'speaker1', 'source-url')
    const withCutout = setSpeakerCutout(withSource, 'speaker1', 'cutout-url', 'mask-url', 'imgly-wasm')

    expect(withCutout.speaker1.cutoutUrl).toBe('cutout-url')
    expect(withCutout.speaker1.maskUrl).toBe('mask-url')
    expect(withCutout.speaker1.removerId).toBe('imgly-wasm')
    expect(withCutout.speaker1.isProcessing).toBe(false)
  })

  it('updates speaker transform coordinates, scale and rotation', () => {
    const project = createDefaultProject()
    const updated = updateSpeakerTransform(project, 'speaker2', {
      x: 800,
      y: 400,
      scaleX: 0.8,
      scaleY: 0.8,
      rotation: 5,
    })

    expect(updated.speaker2.transform.x).toBe(800)
    expect(updated.speaker2.transform.y).toBe(400)
    expect(updated.speaker2.transform.scaleX).toBe(0.8)
    expect(updated.speaker2.transform.rotation).toBe(5)
  })

  it('toggles speaker visibility', () => {
    const project = createDefaultProject()
    expect(project.speaker1.visible).toBe(true)

    const hidden = toggleSpeakerVisibility(project, 'speaker1')
    expect(hidden.speaker1.visible).toBe(false)

    const shown = toggleSpeakerVisibility(hidden, 'speaker1')
    expect(shown.speaker1.visible).toBe(true)
  })

  it('clears speaker slot when removed', () => {
    let project = createDefaultProject()
    project = setSpeakerSource(project, 'speaker1', 'source-url')
    project = setSpeakerCutout(project, 'speaker1', 'cutout-url', 'mask-url')

    const cleared = removeSpeaker(project, 'speaker1')
    expect(cleared.speaker1.sourceImageUrl).toBeNull()
    expect(cleared.speaker1.cutoutUrl).toBeNull()
    expect(cleared.speaker1.maskUrl).toBeNull()
  })

  it('reorders layers correctly', () => {
    const project = createDefaultProject()
    const reordered = reorderLayers(project, ['background', 'speaker2', 'speaker1', 'text'])

    expect(reordered.layerOrder).toEqual(['background', 'speaker2', 'speaker1', 'text'])
  })

  it('applies composition template preserving existing source assets', () => {
    let project = createDefaultProject()
    project = setSpeakerSource(project, 'speaker1', 'speaker1-photo')
    project = setSpeakerSource(project, 'speaker2', 'speaker2-photo')
    project.text.text = 'Custom Title'

    const template: CompositionTemplate = {
      id: 'side-by-side',
      name: 'Side by Side Duet',
      backgroundTransform: { x: 0, y: 0, scaleX: 1, scaleY: 1 },
      speaker1Transform: { x: 250, y: 360, scaleX: 0.9, scaleY: 0.9, rotation: -2 },
      speaker2Transform: { x: 1030, y: 360, scaleX: 0.9, scaleY: 0.9, rotation: 2 },
      textStyleAndPosition: {
        fontFamily: 'Impact',
        fontSize: 88,
        fontWeight: 'bold',
        textAlign: 'center',
        fillColor: '#FFCC00',
        strokeColor: '#000000',
        strokeWidth: 4,
        transform: { x: 640, y: 120, scaleX: 1, scaleY: 1, rotation: 0 },
        visible: true,
      },
    }

    const applied = applyTemplateToProject(project, template)

    // Assets and text content are preserved
    expect(applied.speaker1.sourceImageUrl).toBe('speaker1-photo')
    expect(applied.speaker2.sourceImageUrl).toBe('speaker2-photo')
    expect(applied.text.text).toBe('Custom Title')

    // Transforms and styles are updated from template
    expect(applied.speaker1.transform.x).toBe(250)
    expect(applied.speaker2.transform.x).toBe(1030)
    expect(applied.text.fontFamily).toBe('Impact')
    expect(applied.text.fontSize).toBe(88)
    expect(applied.text.fillColor).toBe('#FFCC00')
  })
})
