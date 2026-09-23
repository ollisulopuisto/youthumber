import { describe, it, expect } from 'vitest'
import {
  createDefaultProject,
  setSpeakerSource,
  setSpeakerCutout,
  updateSpeakerMaskOptions,
} from '../modules/thumbnail/thumbnailState'
import { applyMaskToImageData } from '../services/background-removal/composite'

describe('Mask Refinement (Feather, Choke/Expand, Opacity)', () => {
  it('updates speaker mask refinement options in project state', () => {
    let project = createDefaultProject()
    const id = project.speakers[0].id
    project = setSpeakerSource(project, id, 'photo1')
    project = setSpeakerCutout(project, id, 'cutout1', 'mask1')

    const updated = updateSpeakerMaskOptions(project, id, {
      feather: 4,
      threshold: 120,
      opacity: 0.9,
    })

    expect(updated.speakers[0].maskOptions).toMatchObject({ feather: 4, threshold: 120, opacity: 0.9 })
  })

  it('adjusts alpha channel when choke threshold is increased', () => {
    // 1x2 pixels: first has mask 200, second has mask 100
    const sourceData = new Uint8ClampedArray([
      255, 0, 0, 255,
      255, 0, 0, 255
    ])
    const maskData = new Uint8ClampedArray([
      200, 200, 200, 255,
      100, 100, 100, 255
    ])

    // Without threshold (threshold: 0)
    const normal = applyMaskToImageData(sourceData, maskData, 2, 1, { threshold: 0 })
    expect(normal[3]).toBe(200)
    expect(normal[7]).toBe(100)

    // With choke threshold = 150: pixel 2 (100) gets cut off to 0
    const choked = applyMaskToImageData(sourceData, maskData, 2, 1, { threshold: 150 })
    expect(choked[3]).toBe(200)
    expect(choked[7]).toBe(0)
  })

  it('supports inverting the mask', () => {
    const sourceData = new Uint8ClampedArray([255, 0, 0, 255])
    const maskData = new Uint8ClampedArray([255, 255, 255, 255])

    const inverted = applyMaskToImageData(sourceData, maskData, 1, 1, { invert: true })
    expect(inverted[3]).toBe(0) // 255 - 255 = 0
  })

  it('preserves existing mask options when partially updating', () => {
    let project = createDefaultProject()
    const id = project.speakers[0].id
    project = updateSpeakerMaskOptions(project, id, { feather: 5, opacity: 0.8 })
    project = updateSpeakerMaskOptions(project, id, { threshold: 40 })

    expect(project.speakers[0].maskOptions).toMatchObject({ feather: 5, threshold: 40, opacity: 0.8 })
  })
})
