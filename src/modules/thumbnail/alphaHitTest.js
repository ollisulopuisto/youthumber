import * as fabric from 'fabric'

/** Longest side of the alpha map; plenty to tell a shoulder from the gap beside it. */
const MAP_SIDE = 512

const maps = new WeakMap() // image element -> { width, height, scale, alpha }

/** A downscaled copy of an image's alpha channel, built once per image element. */
export function alphaMapFor(element) {
  const cached = maps.get(element)
  if (cached) return cached
  const naturalWidth = element.naturalWidth || element.width
  const naturalHeight = element.naturalHeight || element.height
  if (!naturalWidth || !naturalHeight) return null
  const scale = Math.min(1, MAP_SIDE / Math.max(naturalWidth, naturalHeight))
  const width = Math.max(1, Math.round(naturalWidth * scale))
  const height = Math.max(1, Math.round(naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(element, 0, 0, width, height)
  const pixels = ctx.getImageData(0, 0, width, height).data
  const alpha = new Uint8Array(width * height)
  for (let i = 0; i < alpha.length; i++) alpha[i] = pixels[i * 4 + 3]
  const map = { width, height, scale, alpha }
  maps.set(element, map)
  return map
}

/** True when every map pixel within `radius` of (x, y) (map px) is fully transparent. */
export function isMapTransparent(map, x, y, radius) {
  const r = Math.max(0, Math.ceil(radius))
  const cx = Math.floor(x)
  const cy = Math.floor(y)
  for (let py = Math.max(0, cy - r); py <= Math.min(map.height - 1, cy + r); py++) {
    for (let px = Math.max(0, cx - r); px <= Math.min(map.width - 1, cx + r); px++) {
      if (map.alpha[py * map.width + px] > 0) return false
    }
  }
  return true
}

/**
 * Per-pixel hit testing for images from a cached alpha map. Fabric's own test redraws the
 * object into a scratch canvas and reads pixels back on every pointer move, which stalls
 * the GPU and made hovering a selected full-HD cutout stutter. Other objects keep Fabric's.
 */
export function installAlphaHitTest(canvas) {
  const fabricTest = canvas.isTargetTransparent.bind(canvas)
  canvas.isTargetTransparent = (target, x, y) => {
    const element = target instanceof fabric.Image && !target.filters?.length && target.getElement()
    const map = element && alphaMapFor(element)
    if (!map) return fabricTest(target, x, y)
    const scene = fabric.util.transformPoint(
      new fabric.Point(x, y),
      fabric.util.invertTransform(canvas.viewportTransform)
    )
    const local = fabric.util.transformPoint(
      scene,
      fabric.util.invertTransform(target.calcTransformMatrix())
    )
    // Image pixels run from the object's top-left; cropX/Y shift into the source.
    const sourceX = local.x + target.width / 2 + (target.cropX || 0)
    const sourceY = local.y + target.height / 2 + (target.cropY || 0)
    const screenPerSource = Math.abs(canvas.getZoom() * target.scaleX) || 1
    const radius = (canvas.targetFindTolerance || target.targetFindTolerance || 0) / screenPerSource
    return isMapTransparent(map, sourceX * map.scale, sourceY * map.scale, radius * map.scale)
  }
}
