/**
 * Placing elements (stickers) and fitting them to the headline. Pure functions; the canvas
 * supplies the headline's box: its centre, size and rotation in canvas pixels.
 */
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './canvasSize'

/** Size of a freshly added element that doesn't fit to the headline: about a fifth of the width. */
export function defaultElementSize(spec) {
  const [vbWidth, vbHeight] = spec.viewBox
  const longest = CANVAS_WIDTH * 0.2
  const scale = longest / Math.max(vbWidth, vbHeight)
  return { width: Math.round(vbWidth * scale), height: Math.round(vbHeight * scale) }
}

/** Rotates a local offset (relative to the box centre) into canvas coordinates. */
function place(box, dx, dy) {
  const a = ((box.rotation || 0) * Math.PI) / 180
  return {
    x: Math.round(box.x + dx * Math.cos(a) - dy * Math.sin(a)),
    y: Math.round(box.y + dx * Math.sin(a) + dy * Math.cos(a)),
  }
}

/**
 * Where and how big an element goes next to the headline `box` ({ x, y, width, height,
 * rotation }), per the element's `fit`. Returns { x, y, width, height, rotation }, or null
 * when the element has no fit.
 */
export function fitElementToBox(spec, box) {
  const fit = spec.fit
  if (!fit || !box) return null
  const [vbWidth, vbHeight] = spec.viewBox
  const aspect = vbHeight / vbWidth
  const rotation = Math.round((box.rotation || 0) + (fit.rotate || 0))
  const h = box.height

  if (fit.mode === 'behind' || fit.mode === 'around') {
    const [padX, padY] = fit.pad ?? [0.25, 0.25]
    return {
      ...place(box, 0, 0),
      width: Math.round(box.width + 2 * padX * h),
      height: Math.round(box.height + 2 * padY * h),
      rotation,
    }
  }
  if (fit.mode === 'under') {
    const width = box.width * 1.04
    const height = Math.min(width * aspect, h * 0.45)
    return { ...place(box, 0, box.height / 2 + height * 0.35), width: Math.round(width), height: Math.round(height), rotation }
  }
  // corner, side, sideLeft: sized by the text height, keeping the element's proportions.
  // A corner piece's longest side is under the text height, so a strip of tape stays small.
  const longest = fit.mode === 'corner' ? h * 0.75 : h * 0.95
  const height = fit.mode === 'corner' ? Math.min(longest, longest * aspect) : longest
  const width = height / aspect
  const offsets = {
    corner: [box.width / 2, -box.height / 2],
    side: [box.width / 2 + width * 0.7, 0],
    sideLeft: [-box.width / 2 - width * 0.4, box.height / 2 + height * 0.2],
  }
  const [dx, dy] = offsets[fit.mode] ?? [0, 0]
  return { ...place(box, dx, dy), width: Math.round(width), height: Math.round(height), rotation }
}

/** Where a new element goes when there is no headline to fit to: the canvas centre. */
export function centredElement(spec) {
  return { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2, ...defaultElementSize(spec), rotation: 0 }
}

/**
 * A new sticker for library element `spec`, fitted to the headline `box` when the element
 * has a fit and there is a headline, otherwise centred.
 * @param {import('../../data/elements').ElementSpec} spec
 * @param {string} id
 * @param {{ x: number, y: number, width: number, height: number, rotation: number } | null} [box]
 * @returns {import('../../types/thumbnail').StickerState}
 */
export function newSticker(spec, id, box = null) {
  const placement = (box && fitElementToBox(spec, box)) || centredElement(spec)
  return {
    id,
    elementId: spec.id,
    colors: { ...spec.colors },
    ...(spec.fit?.clearsText && box ? { text: '' } : {}),
    lineWeight: 1,
    outline: 0,
    outlineColor: '#FFFFFF',
    shadow: !!spec.shadow,
    opacity: spec.opacity ?? 1,
    visible: true,
    flipX: false,
    ...placement,
  }
}

/** Whether a sticker for `spec` belongs under the headline rather than over it. */
export function goesBehindText(spec) {
  return spec.fit?.mode === 'behind'
}
