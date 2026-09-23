/**
 * Pure helpers that turn background settings into Fabric.js gradient and filter values.
 */

/** Fabric gradient options ({ type, coords, colorStops }) for a background gradient. */
export function gradientSpec({ colors, angle = 135, type = 'linear' }, width, height) {
  const cx = width / 2
  const cy = height / 2
  const colorStops = colors.map((color, index) => ({
    offset: index / Math.max(colors.length - 1, 1),
    color,
  }))

  if (type === 'radial') {
    return {
      type: 'radial',
      coords: { x1: cx, y1: cy, r1: 0, x2: cx, y2: cy, r2: Math.hypot(cx, cy) },
      colorStops,
    }
  }

  // A line through the centre at `angle`, long enough to reach the corners.
  const half = Math.hypot(width, height) / 2
  const rad = (angle * Math.PI) / 180
  const dx = Math.cos(rad) * half
  const dy = Math.sin(rad) * half
  return {
    type: 'linear',
    coords: { x1: cx - dx, y1: cy - dy, x2: cx + dx, y2: cy + dy },
    colorStops,
  }
}

/** CSS for a swatch that looks like the canvas gradient. CSS measures 0deg as "up",
 *  the canvas as "left to right", hence the +90. */
export function cssGradient({ colors, angle = 135, type = 'linear' }) {
  if (type === 'radial') return `radial-gradient(circle, ${colors.join(', ')})`
  return `linear-gradient(${angle + 90}deg, ${colors.join(', ')})`
}

/** Radial stops for a vignette: clear through the middle, `strength` black at the corners. */
export function vignetteColorStops(strength) {
  return [
    { offset: 0, color: 'rgba(0,0,0,0)' },
    { offset: 0.55, color: 'rgba(0,0,0,0)' },
    { offset: 1, color: `rgba(0,0,0,${strength})` },
  ]
}

const CANVAS_WIDTH = 1280
// Measured 2026-09-23: Fabric's Blur filter with value b softens an edge across about
// 0.0925 x b x the image width (0.1/0.2/0.3 -> 18/36/53px on a 1920-wide image).
const EDGE_WIDTH_PER_BLUR = 0.0925

/**
 * Fabric filter values for a background photo. `imageBlur` is the width of a softened
 * edge in canvas pixels; the photo is scaled to cover the 1280-wide canvas, so its width
 * maps to the canvas width. `imageDarken` 0–1 lowers brightness.
 */
export function photoFilterValues({ imageBlur = 0, imageDarken = 0 }) {
  return {
    blur: imageBlur / (EDGE_WIDTH_PER_BLUR * CANVAS_WIDTH),
    brightness: imageDarken ? -imageDarken : 0,
  }
}
