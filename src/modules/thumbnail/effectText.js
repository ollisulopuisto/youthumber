import { fabric } from 'fabric'
import {
  accentBoxes,
  accentLineIndices,
  accentLineStyles,
  extrusionOffsets,
  slantToSkewX,
  splashShapes,
  textGradientSpec,
} from './textEffects'

/**
 * Editable headline text that can also draw a splash behind itself and a solid 3D side.
 * Both are drawn inside the text object, so they move, slant and scale with it.
 */
export const EffectText = fabric.util.createClass(fabric.IText, {
  type: 'effect-text',

  initialize(text, options) {
    this.callSuper('initialize', text, options)
    // The splash and the 3D side reach outside the text box, which a cache canvas would clip.
    this.objectCaching = false
  },

  _render(ctx) {
    const effects = this.effects || {}
    if (effects.splashStyle && effects.splashStyle !== 'none') {
      this._renderSplash(ctx, effects)
    }
    if (effects.accentStyle === 'box') this._renderAccentBoxes(ctx, effects)

    const offsets = extrusionOffsets(effects.extrudeDepth, effects.extrudeAngle)
    if (!offsets.length) {
      this.callSuper('_render', ctx)
      return
    }

    // Only the back of the 3D side casts the shadow; every layer casting it would
    // darken the side and multiply the blur cost.
    const { fill, stroke, styles } = this
    this.fill = effects.extrudeColor || '#000000'
    this.stroke = this.strokeWidth ? this.fill : null
    this.styles = {}
    offsets.forEach((offset, i) => {
      ctx.save()
      if (i > 0) this._removeShadow(ctx)
      ctx.translate(offset.x, offset.y)
      this._setTextStyles(ctx)
      this._renderText(ctx)
      ctx.restore()
    })
    this.fill = fill
    this.stroke = stroke
    this.styles = styles

    ctx.save()
    this._removeShadow(ctx)
    this.callSuper('_render', ctx)
    ctx.restore()
  },

  _renderAccentBoxes(ctx, effects) {
    const metrics = []
    let top = -this.height / 2
    for (let i = 0; i < this._textLines.length; i++) {
      const height = this.getHeightOfLine(i)
      metrics.push({
        left: this._getLeftOffset() + this._getLineLeftOffset(i),
        top,
        width: this.getLineWidth(i),
        height: height / this.lineHeight,
      })
      top += height
    }
    const lines = accentLineIndices(this._textLines.length, effects.accentLines)
    const boxes = accentBoxes(metrics, lines, this.fontSize * 0.25)
    if (!boxes.length) return
    ctx.save()
    ctx.fillStyle = effects.accentColor || '#FFE600'
    for (const box of boxes) {
      ctx.beginPath()
      box.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
      ctx.closePath()
      ctx.fill()
    }
    ctx.restore()
  },

  _renderSplash(ctx, effects) {
    const shapes = splashShapes(
      effects.splashStyle,
      this.width,
      this.height,
      effects.splashSeed,
      effects.splashSize ?? 1
    )
    if (!shapes.length) return
    ctx.save()
    const color = effects.splashColor || '#FF1F6B'
    if (effects.splashStyle === 'rays') {
      // Beams fade out towards their ends, so they read as light rather than a wheel.
      const reach = Math.max(this.width, this.height) * (effects.splashSize ?? 1) * 0.9
      const fade = ctx.createRadialGradient(0, 0, 0, 0, 0, reach)
      fade.addColorStop(0, color)
      fade.addColorStop(0.45, color)
      fade.addColorStop(1, transparent(color))
      ctx.fillStyle = fade
      // The headline's shadow under each beam muddied the fade.
      this._removeShadow(ctx)
    } else {
      ctx.fillStyle = color
    }
    ctx.beginPath()
    for (const shape of shapes) {
      if (shape.type === 'circle') {
        ctx.moveTo(shape.x + shape.r, shape.y)
        ctx.arc(shape.x, shape.y, shape.r, 0, Math.PI * 2)
      } else {
        shape.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
        ctx.closePath()
      }
    }
    ctx.fill()
    // Outline the splash in the text's outline colour, comic style. Rays stay unoutlined:
    // outlining every wedge turned them into a heavy black wheel.
    if (this.stroke && this.strokeWidth && effects.splashStyle !== 'rays') {
      this._removeShadow(ctx)
      ctx.lineJoin = 'round'
      ctx.lineWidth = this.strokeWidth
      ctx.strokeStyle = this.stroke
      ctx.stroke()
    }
    ctx.restore()
  },
})

/** `hex` at zero opacity, so a gradient fades out in its own colour instead of through black. */
function transparent(hex) {
  const value = String(hex).replace('#', '')
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value
  const n = parseInt(full.slice(0, 6), 16)
  if (Number.isNaN(n)) return 'rgba(0, 0, 0, 0)'
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, 0)`
}

/** The effect settings EffectText reads, from the headline's state. */
export function effectsFromState(textState) {
  return {
    extrudeDepth: textState.extrudeDepth || 0,
    extrudeAngle: textState.extrudeAngle ?? 45,
    extrudeColor: textState.extrudeColor || '#000000',
    splashStyle: textState.splashStyle || 'none',
    splashColor: textState.splashColor || '#FF1F6B',
    splashSize: textState.splashSize ?? 1.15,
    splashSeed: textState.splashSeed || 1,
    accentStyle: textState.accentStyle || 'color',
    accentLines: textState.accentLines || 'none',
    accentColor: textState.accentColor || '#FFE600',
  }
}

/** Skew, per-line accent colours and gradient fill for a (dimensioned) EffectText. */
export function applyTextColorEffects(textObj, textState) {
  textObj.set({ skewX: slantToSkewX(textState.slant) })

  const lines = (textObj.text || '').split('\n').map((line) => fabric.util.string.graphemeSplit(line))
  // On a bar, the accent line's text takes the bar's contrast colour instead.
  const accentFill =
    textState.accentStyle === 'box' ? textState.accentTextColor || '#000000' : textState.accentColor
  textObj.set({
    styles: accentLineStyles(lines, textState.accentLines, accentFill),
  })

  const base = textState.fillColor || '#FFFFFF'
  if (textState.fillGradient && textState.fillColor2) {
    textObj.initDimensions()
    textObj.set({
      fill: new fabric.Gradient(textGradientSpec([base, textState.fillColor2], textObj.height)),
    })
  } else {
    textObj.set({ fill: base })
  }
}
