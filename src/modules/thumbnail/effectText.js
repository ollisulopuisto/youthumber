import { fabric } from 'fabric'
import {
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
    ctx.fillStyle = effects.splashColor || '#FF1F6B'
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
    // Outline the splash in the text's outline colour, comic style.
    if (this.stroke && this.strokeWidth) {
      this._removeShadow(ctx)
      ctx.lineJoin = 'round'
      ctx.lineWidth = this.strokeWidth
      ctx.strokeStyle = this.stroke
      ctx.stroke()
    }
    ctx.restore()
  },
})

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
  }
}

/** Skew, per-line accent colours and gradient fill for a (dimensioned) EffectText. */
export function applyTextColorEffects(textObj, textState) {
  textObj.set({ skewX: slantToSkewX(textState.slant) })

  const lines = (textObj.text || '').split('\n').map((line) => fabric.util.string.graphemeSplit(line))
  textObj.set({
    styles: accentLineStyles(lines, textState.accentLines, textState.accentColor),
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
