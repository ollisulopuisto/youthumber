import { fabric } from 'fabric'
import { findElement } from '../../data/elements'

const SLOT_DEFAULTS = { ink: '#111111', paper: '#FFFFFF' }

function slotColor(sticker, slot) {
  if (!slot) return null
  if (slot === 'primary' || slot === 'accent') return sticker.colors?.[slot] ?? '#FFFFFF'
  return SLOT_DEFAULTS[slot] ?? slot
}

/** The widest stroke an element draws, in canvas px, so the cache canvas can leave room for it. */
function strokeReach(spec, sticker, uniform) {
  const widest = Math.max(0, ...spec.parts.map((p) => p.width || 0))
  return widest * uniform * (sticker.lineWeight ?? 1) + 2 * (sticker.outline || 0)
}

/**
 * One placed element (sticker). It draws its library element's parts stretched to its
 * width × height, but strokes and text keep even proportions: paths are scaled, the pen
 * isn't. Resizing on the canvas changes width/height, never scaleX/scaleY.
 */
export const ElementObject = fabric.util.createClass(fabric.Object, {
  type: 'element-sticker',

  initialize(options) {
    this.callSuper('initialize', {
      originX: 'center',
      originY: 'center',
      // Cached, so the shadow falls from the element's outline once, not from every part.
      objectCaching: true,
      cornerColor: '#EC4899',
      cornerSize: 12,
      transparentCorners: false,
      borderColor: '#DB2777',
      ...options,
    })
  },

  _getCacheCanvasDimensions() {
    const dims = this.callSuper('_getCacheCanvasDimensions')
    const spec = findElement(this.sticker?.elementId)
    if (!spec) return dims
    const [vbWidth, vbHeight] = spec.viewBox
    const uniform = Math.sqrt((this.width / vbWidth) * (this.height / vbHeight))
    const room = strokeReach(spec, this.sticker, uniform) + 8
    dims.width += room * dims.zoomX
    dims.height += room * dims.zoomY
    return dims
  },

  _render(ctx) {
    const sticker = this.sticker
    const spec = findElement(sticker?.elementId)
    if (!spec) return
    const [vbWidth, vbHeight] = spec.viewBox
    const sx = this.width / vbWidth
    const sy = this.height / vbHeight
    const uniform = Math.sqrt(sx * sy)
    const weight = sticker.lineWeight ?? 1
    const outline = sticker.outline || 0

    ctx.save()
    ctx.translate(-this.width / 2, -this.height / 2)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    const geometry = spec.parts.map((part) => {
      if (part.text !== undefined) return { part }
      const path = new Path2D()
      if (part.circle) {
        const [cx, cy, r] = part.circle
        path.ellipse(cx * sx, cy * sy, r * sx, r * sy, 0, 0, Math.PI * 2)
      } else {
        path.addPath(new Path2D(part.d), new DOMMatrix([sx, 0, 0, sy, 0, 0]))
      }
      return { part, path }
    })

    const drawText = (part, mode, color, width) => {
      const text = part.label ? (sticker.text ?? spec.text ?? part.text) : part.text
      if (!text) return
      ctx.save()
      ctx.translate(part.x * sx, part.y * sy)
      if (part.rotate) ctx.rotate((part.rotate * Math.PI) / 180)
      ctx.font = `${part.size * Math.min(sx, sy)}px ${part.font || 'sans-serif'}`
      ctx.textAlign = 'center'
      const maxWidth = part.maxWidth ? part.maxWidth * sx : undefined
      if (mode === 'stroke') {
        ctx.lineWidth = width
        ctx.strokeStyle = color
        ctx.strokeText(text, 0, 0, maxWidth)
      } else {
        ctx.fillStyle = color
        ctx.fillText(text, 0, 0, maxWidth)
      }
      ctx.restore()
    }

    // 1. Die-cut border: every part fattened by the outline, in the outline colour.
    if (outline > 0) {
      const color = sticker.outlineColor || '#FFFFFF'
      for (const { part, path } of geometry) {
        const pen = part.stroke ? (part.width || 0) * uniform * weight : 0
        if (part.text !== undefined) {
          // Text strokes are drawn at twice the pen (half hides under the fill).
          drawText(part, 'stroke', color, 2 * pen + 2 * outline)
          continue
        }
        const width = pen + 2 * outline
        ctx.lineWidth = width
        ctx.strokeStyle = color
        ctx.stroke(path)
        if (part.fill) {
          ctx.fillStyle = color
          ctx.fill(path)
        }
      }
    }

    // 2. The element itself: fill, then its stroke on top, part by part.
    for (const { part, path } of geometry) {
      const fill = slotColor(sticker, part.fill)
      const stroke = slotColor(sticker, part.stroke)
      const width = (part.width || 0) * uniform * weight
      if (part.text !== undefined) {
        if (stroke && width) drawText(part, 'stroke', stroke, width * 2)
        if (fill) drawText(part, 'fill', fill)
        continue
      }
      if (fill) {
        ctx.fillStyle = fill
        ctx.fill(path)
      }
      if (stroke && width) {
        ctx.lineWidth = width
        ctx.strokeStyle = stroke
        ctx.stroke(path)
      }
    }
    ctx.restore()
  },
})

/** Fabric properties for a sticker's state. */
export function elementObjectProps(sticker) {
  return {
    sticker,
    left: sticker.x,
    top: sticker.y,
    width: Math.max(4, sticker.width),
    height: Math.max(4, sticker.height),
    scaleX: 1,
    scaleY: 1,
    angle: sticker.rotation || 0,
    flipX: !!sticker.flipX,
    opacity: sticker.opacity ?? 1,
    shadow: sticker.shadow
      ? new fabric.Shadow({ color: 'rgba(0, 0, 0, 0.55)', blur: 16, offsetX: 4, offsetY: 8 })
      : null,
    dirty: true,
  }
}
