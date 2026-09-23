import { describe, it, expect, vi, afterEach } from 'vitest'
import { saveExportedImage } from '../services/exportImage'

const DATA_URL = 'data:image/jpeg;base64,AAAA'

afterEach(() => {
  delete (window as unknown as { pywebview?: unknown }).pywebview
  vi.restoreAllMocks()
})

describe('saveExportedImage', () => {
  it('uses the native save dialog in the desktop app, where <a download> does nothing', async () => {
    const saveImage = vi.fn().mockResolvedValue('/Users/me/Downloads/thumb.jpg')
    ;(window as unknown as { pywebview: unknown }).pywebview = { api: { save_image: saveImage } }
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click')

    const result = await saveExportedImage(DATA_URL, 'thumb.jpg')

    expect(saveImage).toHaveBeenCalledWith(DATA_URL, 'thumb.jpg')
    expect(anchorClick).not.toHaveBeenCalled()
    expect(result).toEqual({ savedPath: '/Users/me/Downloads/thumb.jpg' })
  })

  it('reports a cancelled native save dialog as not saved', async () => {
    ;(window as unknown as { pywebview: unknown }).pywebview = {
      api: { save_image: vi.fn().mockResolvedValue(null) },
    }

    expect(await saveExportedImage(DATA_URL, 'thumb.jpg')).toEqual({ savedPath: null })
  })

  it('falls back to a browser download outside the desktop app', async () => {
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    const result = await saveExportedImage(DATA_URL, 'thumb.jpg')

    expect(anchorClick).toHaveBeenCalledOnce()
    expect(result).toEqual({ downloaded: true })
  })
})
