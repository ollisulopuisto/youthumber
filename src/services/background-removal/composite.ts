export interface CompositeOptions {
  opacity?: number // 0 to 1, default 1
  threshold?: number // 0 to 255, if specified clips mask values below threshold to 0
  invert?: boolean // invert mask
  feather?: number // feather radius in pixels (optional)
}

/**
 * Applies a mask (grayscale or RGBA) to source RGBA pixels.
 * Replaces the source alpha channel with the mask intensity.
 */
export function applyMaskToImageData(
  sourceRgba: Uint8ClampedArray,
  maskData: Uint8ClampedArray,
  width: number,
  height: number,
  options: CompositeOptions = {}
): Uint8ClampedArray<ArrayBuffer> {
  const { opacity = 1, threshold, invert = false } = options
  const totalPixels = width * height

  // Optimization: Clone source pixel data in a single native bulk memory copy
  // (new Uint8ClampedArray(sourceRgba)). This avoids 3 manual byte reads and
  // 3 manual byte writes (R, G, B channels) across millions of iterations in JS.
  const output = new Uint8ClampedArray(sourceRgba)
  const isGrayscale = maskData.length === totalPixels
  const hasThreshold = threshold !== undefined
  const threshVal = hasThreshold ? threshold : 0
  const fullOpacity = opacity === 1

  // Only update the alpha channel per pixel.
  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4

    // Determine mask value: mask can be grayscale (1 byte/pixel) or RGBA (R=G=B)
    let maskVal = isGrayscale ? maskData[i] : maskData[idx]

    if (invert) {
      maskVal = 255 - maskVal
    }

    if (hasThreshold && maskVal < threshVal) {
      maskVal = 0
    }

    const alphaIdx = idx + 3
    const sourceAlpha = sourceRgba[alphaIdx]

    // Fast path: for fully opaque source pixels and opacity=1, avoid float div/mul/round.
    output[alphaIdx] =
      fullOpacity && sourceAlpha === 255
        ? maskVal
        : Math.round(maskVal * opacity * (sourceAlpha / 255))
  }

  return output
}

/**
 * Composites a source image and mask image element into a transparent canvas data URL
 */
export async function compositeSourceWithMask(
  sourceImage: HTMLImageElement | HTMLCanvasElement | ImageBitmap,
  maskImage: HTMLImageElement | HTMLCanvasElement | ImageBitmap,
  options: CompositeOptions = {}
): Promise<string> {
  const width = sourceImage.width
  const height = sourceImage.height

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not obtain 2D canvas context')

  // Draw source image
  ctx.drawImage(sourceImage as CanvasImageSource, 0, 0, width, height)
  const sourceImageData = ctx.getImageData(0, 0, width, height)

  // Draw mask image on temporary canvas to get pixel data
  const maskCanvas = document.createElement('canvas')
  maskCanvas.width = width
  maskCanvas.height = height
  const maskCtx = maskCanvas.getContext('2d')
  if (!maskCtx) throw new Error('Could not obtain mask 2D context')

  if (options.feather && options.feather > 0) {
    maskCtx.filter = `blur(${options.feather}px)`
  }

  maskCtx.drawImage(maskImage as CanvasImageSource, 0, 0, width, height)
  const maskImageData = maskCtx.getImageData(0, 0, width, height)

  // Apply mask
  const compositedRgba = applyMaskToImageData(
    sourceImageData.data,
    maskImageData.data,
    width,
    height,
    options
  )

  const outputImageData = new ImageData(compositedRgba, width, height)
  ctx.putImageData(outputImageData, 0, 0)

  const dataUrl = canvas.toDataURL('image/png')
  // WebKit (the desktop window) frees a canvas's bitmap only when the element is
  // collected, which lags far behind its few-KB wrapper: every mask-slider tick left
  // two full-HD bitmaps waiting. Releasing them here keeps that bounded.
  canvas.width = canvas.height = 0
  maskCanvas.width = maskCanvas.height = 0
  return dataUrl
}

export async function compositeFromDataUrls(
  sourceUrl: string,
  maskUrl: string,
  options: CompositeOptions = {}
): Promise<string> {
  const loadImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = url
    })

  const [srcImg, maskImg] = await Promise.all([loadImage(sourceUrl), loadImage(maskUrl)])
  return compositeSourceWithMask(srcImg, maskImg, options)
}
