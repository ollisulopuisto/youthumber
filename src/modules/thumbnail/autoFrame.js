const SAMPLE_WIDTH = 240
const ALPHA_THRESHOLD = 24

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

/**
 * Finds the bounding box of the visible (non-transparent) person pixels in a
 * background-removal cutout. The alpha channel of the cutout IS the Vision
 * segmentation mask, so this bbox reflects where the CoreML/Vision engine
 * detected the subject.
 */
export async function computeCutoutBBox(cutoutUrl) {
  const img = await loadImage(cutoutUrl)
  const width = img.naturalWidth
  const height = img.naturalHeight
  if (!width || !height) return null

  const scaleDown = SAMPLE_WIDTH / width
  const sampleW = Math.max(1, Math.round(width * scaleDown))
  const sampleH = Math.max(1, Math.round(height * scaleDown))

  const canvas = document.createElement('canvas')
  canvas.width = sampleW
  canvas.height = sampleH
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, sampleW, sampleH)

  let data
  try {
    data = ctx.getImageData(0, 0, sampleW, sampleH).data
  } catch {
    return null
  }

  let minX = sampleW
  let minY = sampleH
  let maxX = -1
  let maxY = -1

  for (let y = 0; y < sampleH; y++) {
    for (let x = 0; x < sampleW; x++) {
      const alpha = data[(y * sampleW + x) * 4 + 3]
      if (alpha > ALPHA_THRESHOLD) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }

  if (maxX < minX || maxY < minY) return null

  return {
    width,
    height,
    nx1: minX / sampleW,
    ny1: minY / sampleH,
    nx2: (maxX + 1) / sampleW,
    ny2: (maxY + 1) / sampleH,
  }
}

/**
 * Computes a transform that puts the detected person's centre on the slot's
 * `frame` target (`{ centerX, centerY, personHeight }`, from the current layout)
 * and scales them to that height.
 */
export function computeAutoFrameTransform(bbox, frame) {
  const { width, height, nx1, ny1, nx2, ny2 } = bbox

  const personWidthPx = (nx2 - nx1) * width
  const personHeightPx = (ny2 - ny1) * height
  if (personWidthPx <= 0 || personHeightPx <= 0) return null

  const personCenterXPx = ((nx1 + nx2) / 2) * width
  const personCenterYPx = ((ny1 + ny2) / 2) * height
  const imageCenterXPx = width / 2
  const imageCenterYPx = height / 2

  const { centerX: targetX, centerY: targetY, personHeight } = frame
  const scale = personHeight / personHeightPx

  const offsetX = (personCenterXPx - imageCenterXPx) * scale
  const offsetY = (personCenterYPx - imageCenterYPx) * scale

  return {
    x: Math.round(targetX - offsetX),
    y: Math.round(targetY - offsetY),
    scaleX: Number(scale.toFixed(3)),
    scaleY: Number(scale.toFixed(3)),
  }
}

/** Computes a nice auto-framed transform for a speaker cutout, or null if detection failed. */
export async function autoFrameSpeaker(cutoutUrl, frame) {
  const bbox = await computeCutoutBBox(cutoutUrl)
  if (!bbox) return null
  return computeAutoFrameTransform(bbox, frame)
}
