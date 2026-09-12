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
): Uint8ClampedArray {
  const { opacity = 1, threshold, invert = false } = options
  const totalPixels = width * height
  const output = new Uint8ClampedArray(sourceRgba.length)

  // Copy RGB directly from source
  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4
    output[idx] = sourceRgba[idx]         // R
    output[idx + 1] = sourceRgba[idx + 1] // G
    output[idx + 2] = sourceRgba[idx + 2] // B

    // Determine mask value: mask can be grayscale (1 byte/pixel or R=G=B in RGBA)
    // If maskData is RGBA (length == totalPixels * 4), use R or A
    let maskVal = maskData.length === totalPixels ? maskData[i] : maskData[idx]

    if (invert) {
      maskVal = 255 - maskVal
    }

    if (threshold !== undefined) {
      maskVal = maskVal < threshold ? 0 : maskVal
    }

    // Modulate with opacity and existing source alpha
    const sourceAlpha = sourceRgba[idx + 3] / 255
    const computedAlpha = Math.round(maskVal * opacity * sourceAlpha)

    output[idx + 3] = Math.max(0, Math.min(255, computedAlpha))
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

  return canvas.toDataURL('image/png')
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
