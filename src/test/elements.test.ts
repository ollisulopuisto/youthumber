import { describe, it, expect } from 'vitest'
import { ELEMENTS, ELEMENT_CATEGORIES, elementsByCategory, findElement } from '../data/elements'
import {
  centredElement,
  defaultElementSize,
  fitElementToBox,
  goesBehindText,
  newSticker,
} from '../modules/thumbnail/elementFit'
import {
  addSticker,
  createDefaultProject,
  isSpeakerLayer,
  isStickerLayer,
  newStickerId,
  removeSticker,
  setStickerBehindText,
  updateSticker,
} from '../modules/thumbnail/thumbnailState'

const FIT_MODES = ['behind', 'around', 'under', 'corner', 'side', 'sideLeft']
const SLOTS = ['primary', 'accent', 'ink', 'paper']
const box = { x: 640, y: 120, width: 500, height: 150, rotation: 0 }

describe('element library', () => {
  it('has unique ids, known categories, slots and fits', () => {
    const ids = ELEMENTS.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
    const categories = ELEMENT_CATEGORIES.map((c) => c.id)
    for (const element of ELEMENTS) {
      expect(categories, element.id).toContain(element.category)
      expect(element.viewBox).toHaveLength(2)
      expect(element.parts.length, element.id).toBeGreaterThan(0)
      if (element.fit) expect(FIT_MODES, element.id).toContain(element.fit.mode)
      for (const part of element.parts) {
        expect(part.d || part.circle || part.text !== undefined, element.id).toBeTruthy()
        if (part.fill) expect(SLOTS, element.id).toContain(part.fill)
        if (part.stroke) expect(SLOTS, element.id).toContain(part.stroke)
        if (part.d) expect(part.d, element.id).toMatch(/^M[\d.\s-]/)
        if (part.d) expect(part.d, element.id).not.toMatch(/NaN|undefined/)
      }
    }
  })

  it('gives every labelled element default text', () => {
    for (const element of ELEMENTS.filter((e) => e.parts.some((p) => p.label))) {
      expect(element.text, element.id).toBeTruthy()
    }
  })

  it('lists every element under its category, with the headline companions first', () => {
    const grouped = elementsByCategory()
    expect(grouped[0].id).toBe('headline')
    expect(grouped.flatMap((c) => c.elements)).toHaveLength(ELEMENTS.length)
    expect(grouped[0].elements.length).toBeGreaterThanOrEqual(8)
  })
})

describe('fitElementToBox', () => {
  it('stretches a behind element over the headline with padding', () => {
    const fitted = fitElementToBox(findElement('brush-banner'), box)!
    expect(fitted.x).toBe(640)
    expect(fitted.y).toBe(120)
    expect(fitted.width).toBeGreaterThan(box.width)
    expect(fitted.height).toBeGreaterThan(box.height)
  })

  it('puts an underline below the headline, as wide as it', () => {
    const fitted = fitElementToBox(findElement('underline'), box)!
    expect(fitted.y).toBeGreaterThan(box.y + box.height / 2)
    expect(fitted.width).toBeGreaterThanOrEqual(box.width)
    expect(fitted.height).toBeLessThan(box.height)
  })

  it('puts corner, side and sideLeft elements where they belong', () => {
    const corner = fitElementToBox(findElement('sparkle'), box)!
    expect(corner.x).toBe(box.x + box.width / 2)
    expect(corner.y).toBe(box.y - box.height / 2)
    const side = fitElementToBox(findElement('exclamation'), box)!
    expect(side.x).toBeGreaterThan(box.x + box.width / 2)
    const left = fitElementToBox(findElement('pointer-arrow'), box)!
    expect(left.x).toBeLessThan(box.x - box.width / 2)
    expect(left.y).toBeGreaterThan(box.y)
  })

  it('keeps corner pieces smaller than the text height', () => {
    const tape = fitElementToBox(findElement('tape'), box)!
    expect(Math.max(tape.width, tape.height)).toBeLessThanOrEqual(box.height * 0.75 + 1)
  })

  it('follows the headline’s rotation', () => {
    const tilted = fitElementToBox(findElement('underline'), { ...box, rotation: 90 })!
    expect(tilted.rotation).toBe(90)
    // Below the text in its own frame is to the left on the canvas when turned 90°.
    expect(tilted.x).toBeLessThan(box.x)
    expect(tilted.y).toBe(box.y)
  })

  it('returns null without a fit or a box', () => {
    expect(fitElementToBox(findElement('microphone'), box)).toBeNull()
    expect(fitElementToBox(findElement('underline'), null)).toBeNull()
  })
})

describe('newSticker', () => {
  it('fits to the headline when it can, otherwise centres at a default size', () => {
    const fitted = newSticker(findElement('highlighter')!, 'stk_a', box)
    expect(fitted.width).toBeGreaterThan(box.width)
    const mic = findElement('microphone')!
    const centred = newSticker(mic, 'stk_b', box)
    expect(centred).toMatchObject(centredElement(mic))
    expect(centred).toMatchObject(defaultElementSize(mic))
    expect(centred.colors).toEqual(mic.colors)
  })

  it('empties a bubble’s own text when it wraps the headline', () => {
    expect(newSticker(findElement('speech')!, 'stk_c', box).text).toBe('')
    expect(newSticker(findElement('speech')!, 'stk_d', null).text).toBeUndefined()
  })

  it('knows which elements go behind the text', () => {
    expect(goesBehindText(findElement('torn-paper'))).toBe(true)
    expect(goesBehindText(findElement('scribble-circle'))).toBe(false)
  })
})

describe('sticker state', () => {
  const make = () => newSticker(findElement('live')!, newStickerId(), null)

  it('tells stickers from speakers', () => {
    const id = newStickerId()
    expect(isStickerLayer(id)).toBe(true)
    expect(isSpeakerLayer(id)).toBe(false)
    expect(isSpeakerLayer(createDefaultProject().speakers[0].id)).toBe(true)
  })

  it('adds on top, or just under the headline', () => {
    const project = createDefaultProject()
    const top = make()
    const behind = make()
    let next = addSticker(project, top)
    expect(next.layerOrder.at(-1)).toBe(top.id)
    next = addSticker(next, behind, true)
    expect(next.layerOrder.indexOf(behind.id)).toBe(next.layerOrder.indexOf('text') - 1)
    expect(next.stickers).toHaveLength(2)
  })

  it('updates colours per slot, moves and removes', () => {
    const sticker = make()
    let project = addSticker(createDefaultProject(), sticker)
    project = updateSticker(project, sticker.id, { colors: { accent: '#000000' }, lineWeight: 2 })
    expect(project.stickers![0].colors).toEqual({ ...sticker.colors, accent: '#000000' })
    expect(project.stickers![0].lineWeight).toBe(2)
    project = setStickerBehindText(project, sticker.id, true)
    expect(project.layerOrder.indexOf(sticker.id)).toBeLessThan(project.layerOrder.indexOf('text'))
    project = removeSticker(project, sticker.id)
    expect(project.stickers).toHaveLength(0)
    expect(project.layerOrder).not.toContain(sticker.id)
  })
})
