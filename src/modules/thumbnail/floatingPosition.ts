/**
 * Where to put the small floating things around the canvas: the selection bar and the
 * right-click menu. Everything is in window (CSS) pixels.
 */

export interface Rect {
  left: number
  top: number
  width: number
  height: number
}

export interface Size {
  width: number
  height: number
}

/** The part of `a` inside `b`, or null when they don't overlap. */
export function intersectRect(a: Rect, b: Rect): Rect | null {
  const left = Math.max(a.left, b.left)
  const top = Math.max(a.top, b.top)
  const right = Math.min(a.left + a.width, b.left + b.width)
  const bottom = Math.min(a.top + a.height, b.top + b.height)
  if (right <= left || bottom <= top) return null
  return { left, top, width: right - left, height: bottom - top }
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max))

/**
 * The selection bar's top-left corner: centred over the visible part of the object,
 * `gap` px above it, or below it when there's no room above, or just inside its top edge
 * when it fills the view. Always `margin` px inside the viewport; null when the object is
 * scrolled out of view.
 */
export function placeBar(
  objRect: Rect,
  viewportRect: Rect,
  barSize: Size,
  gap = 8,
  margin = 8
): { left: number; top: number; placement: 'above' | 'below' | 'inside' } | null {
  const visible = intersectRect(objRect, viewportRect)
  if (!visible) return null
  const minLeft = viewportRect.left + margin
  const maxLeft = viewportRect.left + viewportRect.width - margin - barSize.width
  const left = Math.max(minLeft, Math.min(visible.left + visible.width / 2 - barSize.width / 2, maxLeft))
  const minTop = viewportRect.top + margin
  const maxTop = viewportRect.top + viewportRect.height - margin - barSize.height

  const above = visible.top - gap - barSize.height
  if (above >= minTop) return { left, top: above, placement: 'above' }
  const below = visible.top + visible.height + gap
  if (below <= maxTop) return { left, top: below, placement: 'below' }
  return { left, top: clamp(visible.top + gap, minTop, Math.max(minTop, maxTop)), placement: 'inside' }
}

/** A menu opened at `point`: down and right of it, flipped back where it would leave the viewport. */
export function placeMenu(point: { x: number; y: number }, viewportRect: Rect, size: Size, margin = 8) {
  const right = viewportRect.left + viewportRect.width - margin
  const bottom = viewportRect.top + viewportRect.height - margin
  const left = point.x + size.width <= right ? point.x : point.x - size.width
  const top = point.y + size.height <= bottom ? point.y : point.y - size.height
  return {
    left: clamp(left, viewportRect.left + margin, Math.max(viewportRect.left + margin, right - size.width)),
    top: clamp(top, viewportRect.top + margin, Math.max(viewportRect.top + margin, bottom - size.height)),
  }
}
