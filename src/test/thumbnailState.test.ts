import { describe, it, expect } from 'vitest'
import {
  createDefaultProject,
  setSpeakerSource,
  setSpeakerCutout,
  updateSpeakerTransform,
  toggleSpeakerVisibility,
  clearSpeakerImage,
  reorderLayers,
  applyLayout,
  setSpeakerCount,
  moveSpeaker,
  renameSpeaker,
  slotFrameFor,
  speakerLabel,
  isSpeakerLayer,
  setBackgroundGradient,
  setBackgroundColor,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
} from '../modules/thumbnail/thumbnailState'
import { getDefaultLayout, getLayout } from '../modules/thumbnail/layouts'

describe('Thumbnail State Management', () => {
  it('creates a default two-speaker project on a 1280x720 canvas', () => {
    const project = createDefaultProject('My Thumbnail')
    const [host, guest] = project.speakers

    expect(project.canvas).toEqual({ width: CANVAS_WIDTH, height: CANVAS_HEIGHT })
    expect(project.speakers).toHaveLength(2)
    expect(project.layoutId).toBe(getDefaultLayout(2).id)
    expect(project.layerOrder).toEqual(['background', host.id, guest.id, 'text'])
    expect(host.name).toBe('Host')
    expect(guest.name).toBe('Guest')
    expect(host.id).not.toBe(guest.id)
  })

  it('creates a project with any supported speaker count', () => {
    for (const n of [1, 3, 4]) {
      const project = createDefaultProject('P', n)
      expect(project.speakers).toHaveLength(n)
      expect(project.layoutId).toBe(getDefaultLayout(n).id)
    }
  })

  it('places speakers at their layout slots, left to right', () => {
    const project = createDefaultProject('P', 3)
    const xs = project.speakers.map((s) => s.transform.x)
    expect(xs).toEqual(getDefaultLayout(3).slots.map((slot) => slot.transform.x))
  })

  it('updates a speaker source image by id and resets its cutout', () => {
    const project = createDefaultProject()
    const id = project.speakers[0].id
    const updated = setSpeakerSource(project, id, 'data:image/jpeg;base64,source1')

    expect(updated.speakers[0].sourceImageUrl).toBe('data:image/jpeg;base64,source1')
    expect(updated.speakers[0].cutoutUrl).toBeNull()
    expect(updated.speakers[1]).toBe(project.speakers[1])
  })

  it('sets mask and cutout once background removal completes', () => {
    let project = createDefaultProject()
    const id = project.speakers[0].id
    project = setSpeakerSource(project, id, 'source-url')
    project = setSpeakerCutout(project, id, 'cutout-url', 'mask-url', 'imgly-wasm')

    expect(project.speakers[0]).toMatchObject({
      cutoutUrl: 'cutout-url',
      maskUrl: 'mask-url',
      removerId: 'imgly-wasm',
      isProcessing: false,
    })
  })

  it('updates one speaker transform without touching the others', () => {
    const project = createDefaultProject()
    const id = project.speakers[1].id
    const updated = updateSpeakerTransform(project, id, { x: 800, rotation: 5 })

    expect(updated.speakers[1].transform.x).toBe(800)
    expect(updated.speakers[1].transform.rotation).toBe(5)
    expect(updated.speakers[0].transform).toEqual(project.speakers[0].transform)
  })

  it('toggles speaker visibility', () => {
    const project = createDefaultProject()
    const id = project.speakers[0].id
    const hidden = toggleSpeakerVisibility(project, id)
    expect(hidden.speakers[0].visible).toBe(false)
    expect(toggleSpeakerVisibility(hidden, id).speakers[0].visible).toBe(true)
  })

  it('clears a speaker image but keeps the speaker', () => {
    let project = createDefaultProject()
    const id = project.speakers[0].id
    project = setSpeakerSource(project, id, 'source-url')
    project = setSpeakerCutout(project, id, 'cutout-url', 'mask-url')

    const cleared = clearSpeakerImage(project, id)
    expect(cleared.speakers).toHaveLength(2)
    expect(cleared.speakers[0]).toMatchObject({ sourceImageUrl: null, cutoutUrl: null, maskUrl: null })
  })

  it('renames a speaker', () => {
    const project = createDefaultProject()
    const renamed = renameSpeaker(project, project.speakers[0].id, 'Olli')
    expect(renamed.speakers[0].name).toBe('Olli')
  })

  it('reorders layers', () => {
    const project = createDefaultProject()
    const [a, b] = project.speakers.map((s) => s.id)
    expect(reorderLayers(project, ['background', b, a, 'text']).layerOrder).toEqual([
      'background',
      b,
      a,
      'text',
    ])
  })

  it('labels speakers by position and name', () => {
    let project = createDefaultProject('P', 3)
    project = renameSpeaker(project, project.speakers[0].id, 'Olli')

    expect(project.speakers.map((s) => speakerLabel(project, s.id))).toEqual([
      'Left · Olli',
      'Centre · Guest',
      'Right · Guest 2',
    ])
  })

  it('identifies speaker layers', () => {
    const project = createDefaultProject()
    expect(isSpeakerLayer(project.speakers[0].id)).toBe(true)
    expect(isSpeakerLayer('background')).toBe(false)
    expect(isSpeakerLayer('text')).toBe(false)
  })

  describe('setSpeakerCount', () => {
    it('adds speakers on the right, keeps existing images, and switches to that count’s layout', () => {
      let project = createDefaultProject()
      const [host, guest] = project.speakers
      project = setSpeakerSource(project, host.id, 'host-photo')
      project = setSpeakerSource(project, guest.id, 'guest-photo')

      const three = setSpeakerCount(project, 3)

      expect(three.speakers).toHaveLength(3)
      expect(three.speakers[0].sourceImageUrl).toBe('host-photo')
      expect(three.speakers[1].sourceImageUrl).toBe('guest-photo')
      expect(three.speakers[2].name).toBe('Guest 2')
      expect(three.layoutId).toBe(getDefaultLayout(3).id)
      expect(three.speakers.map((s) => s.transform.x)).toEqual(
        getDefaultLayout(3).slots.map((slot) => slot.transform.x)
      )
      expect(three.layerOrder).toEqual(['background', ...three.speakers.map((s) => s.id), 'text'])
    })

    it('drops speakers from the right and removes them from the layer order', () => {
      const project = createDefaultProject('P', 3)
      const one = setSpeakerCount(project, 1)

      expect(one.speakers.map((s) => s.id)).toEqual([project.speakers[0].id])
      expect(one.layerOrder).toEqual(['background', project.speakers[0].id, 'text'])
      expect(one.layoutId).toBe(getDefaultLayout(1).id)
    })

    it('keeps a custom layer order for speakers that stay', () => {
      let project = createDefaultProject()
      const [a, b] = project.speakers.map((s) => s.id)
      project = reorderLayers(project, ['background', 'text', b, a])

      const three = setSpeakerCount(project, 3)

      const newId = three.speakers[2].id
      expect(three.layerOrder.filter((l) => l !== newId)).toEqual(['background', 'text', b, a])
      expect(three.layerOrder).toContain(newId)
    })

    it('clamps to 1–4 speakers', () => {
      const project = createDefaultProject()
      expect(setSpeakerCount(project, 0).speakers).toHaveLength(1)
      expect(setSpeakerCount(project, 9).speakers).toHaveLength(4)
    })
  })

  describe('moveSpeaker', () => {
    it('swaps a speaker with its neighbour and re-applies slot positions', () => {
      const project = createDefaultProject('P', 3)
      const [a, b, c] = project.speakers.map((s) => s.id)

      const moved = moveSpeaker(project, a, 1)

      expect(moved.speakers.map((s) => s.id)).toEqual([b, a, c])
      expect(moved.speakers.map((s) => s.transform.x)).toEqual(
        getDefaultLayout(3).slots.map((slot) => slot.transform.x)
      )
    })

    it('does nothing when moving past either end', () => {
      const project = createDefaultProject()
      expect(moveSpeaker(project, project.speakers[0].id, -1)).toBe(project)
      expect(moveSpeaker(project, project.speakers[1].id, 1)).toBe(project)
    })
  })

  it('applies a layout while preserving images and headline text', () => {
    let project = createDefaultProject()
    const [a, b] = project.speakers.map((s) => s.id)
    project = setSpeakerSource(project, a, 'photo-a')
    project = setSpeakerSource(project, b, 'photo-b')
    project = { ...project, text: { ...project.text, text: 'Custom Title' } }
    const layout = getLayout('host-guest-spotlight')!

    const applied = applyLayout(project, layout)

    expect(applied.layoutId).toBe('host-guest-spotlight')
    expect(applied.speakers[0].sourceImageUrl).toBe('photo-a')
    expect(applied.speakers[0].transform).toEqual(layout.slots[0].transform)
    expect(applied.speakers[1].transform).toEqual(layout.slots[1].transform)
    expect(applied.text.text).toBe('Custom Title')
    expect(applied.text.fontFamily).toBe(layout.textStyleAndPosition.fontFamily)
  })

  it('ignores a layout built for a different speaker count', () => {
    const project = createDefaultProject()
    expect(applyLayout(project, getDefaultLayout(3))).toBe(project)
  })

  it('returns the auto-frame target for a speaker’s current position', () => {
    const project = createDefaultProject('P', 3)
    const centre = project.speakers[1].id

    expect(slotFrameFor(project, centre)).toEqual(getDefaultLayout(3).slots[1].frame)
  })

  it('sets a gradient background and switching back to a solid color clears the gradient type', () => {
    const project = createDefaultProject()
    const withGradient = setBackgroundGradient(project, { colors: ['#FF0080', '#7928CA'], angle: 135 })
    expect(withGradient.background.type).toBe('gradient')

    const backToSolid = setBackgroundColor(withGradient, '#111827')
    expect(backToSolid.background.type).toBe('solid')
    expect(backToSolid.background.color).toBe('#111827')
  })
})
