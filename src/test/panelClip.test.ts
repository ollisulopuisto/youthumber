import { describe, it, expect } from 'vitest'
import * as fabric from 'fabric'
import { clipToPanel } from '../modules/thumbnail/panelClip'

const W = 720
const H = 1280
const TOP = { x: 0, y: 0, width: W, height: 405 }

/** A red block as large as the canvas, standing in for a speaker image. */
function layer() {
  return new fabric.Rect({ left: 0, top: 0, width: W, height: H, fill: '#ff0000', originX: 'left', originY: 'top' })
}

function render(objects: fabric.FabricObject[], multiplier = 1) {
  const canvas = new fabric.StaticCanvas(undefined, { width: W, height: H, backgroundColor: '#000000' })
  objects.forEach((o) => canvas.add(o))
  canvas.renderAll()
  const out = canvas.toCanvasElement(multiplier)
  const ctx = out.getContext('2d')!
  const px = (x: number, y: number) => Array.from(ctx.getImageData(Math.round(x * multiplier), Math.round(y * multiplier), 1, 1).data)
  return px
}

const RED = [255, 0, 0, 255]
const BLACK = [0, 0, 0, 255]

describe('clipToPanel', () => {
  it('shows the layer only inside the panel', () => {
    const o = layer()
    clipToPanel(o, TOP)
    const px = render([o])
    expect(px(360, 200)).toEqual(RED)
    expect(px(360, 600)).toEqual(BLACK)
  })

  it('keeps the clip fixed to the canvas when the layer is moved, scaled and rotated', () => {
    const o = layer()
    clipToPanel(o, TOP)
    o.set({ left: 100, top: 300, scaleX: 1.5, scaleY: 1.5, angle: 20 })
    o.setCoords()
    const px = render([o])
    // Below the panel stays empty even though the transformed layer covers it.
    expect(px(360, 700)).toEqual(BLACK)
    expect(px(360, 1000)).toEqual(BLACK)
  })

  it('removes the clip when the layout has no panel', () => {
    const o = layer()
    clipToPanel(o, TOP)
    clipToPanel(o, undefined)
    expect(o.clipPath).toBeUndefined()
    expect(render([o])(360, 1000)).toEqual(RED)
  })

  it('replaces the clip when the panel changes', () => {
    const o = layer()
    clipToPanel(o, TOP)
    clipToPanel(o, { x: 0, y: 640, width: W, height: 640 })
    const px = render([o])
    expect(px(360, 200)).toEqual(BLACK)
    expect(px(360, 900)).toEqual(RED)
  })

  it('stays aligned in a 1.5x export (1080x1920)', () => {
    const o = layer()
    clipToPanel(o, TOP)
    const px = render([o], 1.5)
    expect(px(360, 400)).toEqual(RED)
    expect(px(360, 410)).toEqual(BLACK)
  })
})
