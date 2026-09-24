import { fabric } from 'fabric'
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './canvasSize'
import { decorShapes } from './decor'

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
    ctx.save()
    // Fabric draws objects around their centre.
    ctx.translate(-this.width / 2, -this.height / 2)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const shape of decorShapes(this.decor, this.width, this.height)) {
      ctx.globalAlpha = shape.alpha ?? 1
      ctx.beginPath()
      if (shape.kind === 'circle') {
        ctx.arc(shape.x, shape.y, shape.r, 0, Math.PI * 2)
        ctx.fillStyle = shape.fill
        ctx.fill()
      } else if (shape.kind === 'poly') {
        shape.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
        ctx.closePath()
        ctx.fillStyle = shape.fill
        ctx.fill()
      } else if (shape.kind === 'line') {
        shape.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
        ctx.strokeStyle = shape.stroke
        ctx.lineWidth = shape.width
        ctx.stroke()
      }
    }
    ctx.restore()
  },
})
