/**
 * Cropping an image layer (a speaker's photo, a logo). A crop is how much to cut from each
 * edge, as a share of the full image: { left: 0.1 } hides the left tenth. The layer keeps
 * its position and size as if it were uncropped, so cropping never moves what stays visible.
 * Rotation and flip are applied by the canvas around the visible part's centre; the helpers
 * here turn the two views into each other.
 */
export interface Crop {
  left: number
  top: number
  right: number
  bottom: number
}

export type CropEdge = keyof Crop

/** At least this share of each side stays visible. */
export const MIN_VISIBLE = 0.1

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const round = (v: number) => Math.round(v * 1000) / 1000

/** A saved or typed crop made safe: numbers in range, an opposite pair never emptying the image. undefined when nothing is cut. */
export function normalizeCrop(raw?: Partial<Crop> | null): Crop | undefined {
  const pick = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? clamp(v, 0, 1 - MIN_VISIBLE) : 0)
  let { left, top, right, bottom } = { left: pick(raw?.left), top: pick(raw?.top), right: pick(raw?.right), bottom: pick(raw?.bottom) }
  const room = 1 - MIN_VISIBLE
  if (left + right > room) right = Math.max(0, room - left)
  if (top + bottom > room) bottom = Math.max(0, room - top)
  const crop = { left: round(left), top: round(top), right: round(right), bottom: round(bottom) }
  return crop.left || crop.top || crop.right || crop.bottom ? crop : undefined
}

/** `crop` with one edge set to `value`; the opposite edge gives way before the image vanishes. */
export function setCropEdge(crop: Crop | undefined, edge: CropEdge, value: number): Crop | undefined {
  const next = { left: 0, top: 0, right: 0, bottom: 0, ...crop }
  const opposite: Record<CropEdge, CropEdge> = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' }
  const room = 1 - MIN_VISIBLE
  next[edge] = clamp(value, 0, room)
  // The edge being dragged wins; the other one backs off.
  if (next[edge] + next[opposite[edge]] > room) next[opposite[edge]] = room - next[edge]
  return normalizeCrop(next)
}

/** The part of the source image to draw, in source pixels. */
export function cropSource(naturalWidth: number, naturalHeight: number, crop?: Crop) {
  const c = crop ?? { left: 0, top: 0, right: 0, bottom: 0 }
  return {
    cropX: c.left * naturalWidth,
    cropY: c.top * naturalHeight,
    width: (1 - c.left - c.right) * naturalWidth,
    height: (1 - c.top - c.bottom) * naturalHeight,
  }
}

/** The share of the full image that stays visible, per axis. */
export function visibleShare(crop?: Crop) {
  return { x: 1 - (crop?.left ?? 0) - (crop?.right ?? 0), y: 1 - (crop?.top ?? 0) - (crop?.bottom ?? 0) }
}

/**
 * Where the visible part's centre sits relative to the full image's centre, in canvas
 * pixels, once the layer is scaled, flipped and rotated (degrees, clockwise).
 */
export function cropOffset(
  naturalWidth: number,
  naturalHeight: number,
  crop: Crop | undefined,
  scaleX: number,
  scaleY: number,
  angle: number,
  flipX = false
) {
  if (!crop) return { dx: 0, dy: 0 }
  let lx = ((crop.left - crop.right) / 2) * naturalWidth * scaleX
  const ly = ((crop.top - crop.bottom) / 2) * naturalHeight * scaleY
  // A flipped image draws its left edge on the right.
  if (flipX) lx = -lx
  const a = (angle * Math.PI) / 180
  return { dx: lx * Math.cos(a) - ly * Math.sin(a), dy: lx * Math.sin(a) + ly * Math.cos(a) }
}
