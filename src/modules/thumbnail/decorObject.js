import { fabric } from 'fabric'
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './canvasSize'
import { decorShapes } from './decor'

function rgba(hex, alpha = 1) {
  const value = String(hex).replace('#', '')
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value
  const n = parseInt(full.slice(0, 6), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

function canvasGradient(ctx, spec) {
  const gradient =
    spec.type === 'radial'
      ? ctx.createRadialGradient(spec.x, spec.y, spec.r0, spec.x, spec.y, spec.r1)
      : ctx.createLinearGradient(spec.x0, spec.y0, spec.x1, spec.y1)
  for (const stop of spec.stops) {
    gradient.addColorStop(stop.offset, rgba(stop.color, stop.alpha ?? 1))
  }
  return gradient
}

/** The Graphics layer: one full-canvas, click-through object that draws decorShapes(). */
export const DecorLayer = fabric.util.createClass(fabric.Object, {
  type: 'decor-layer',

  initialize(options) {
    this.callSuper('initialize', {
      left: 0,
      top: 0,
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      originX: 'left',
      originY: 'top',
      selectable: false,
      evented: false,
      objectCaching: false,
      ...options,
    })
  },

  _render(ctx) {
    // shadowBlur is in device pixels and ignores the canvas transform, so scale the glow
    // by the current zoom; otherwise the preview glows more than the export.
    const transform = ctx.getTransform()
    const zoom = Math.hypot(transform.a, transform.b) || 1

    ctx.save()
    // Fabric draws objects around their centre.
    ctx.translate(-this.width / 2, -this.height / 2)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const shape of decorShapes(this.decor, this.width, this.height)) {
      ctx.save()
      ctx.globalAlpha = shape.alpha ?? 1
      if (shape.blend) ctx.globalCompositeOperation = shape.blend
      if (shape.glow) {
        ctx.shadowBlur = shape.glow * zoom
        ctx.shadowColor = shape.glowColor || shape.fill || shape.stroke
      }
      const paint = shape.gradient ? canvasGradient(ctx, shape.gradient) : null
      ctx.beginPath()
      if (shape.kind === 'circle') {
        ctx.arc(shape.x, shape.y, shape.r, 0, Math.PI * 2)
        ctx.fillStyle = paint || shape.fill
        ctx.fill()
      } else if (shape.kind === 'poly') {
        shape.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
        ctx.closePath()
        ctx.fillStyle = paint || shape.fill
        ctx.fill()
      } else if (shape.kind === 'line') {
        shape.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
        ctx.strokeStyle = paint || shape.stroke
        ctx.lineWidth = shape.width
        ctx.stroke()
      }
      ctx.restore()
    }
    ctx.restore()
  },
})
