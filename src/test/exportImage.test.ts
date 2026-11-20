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

  const desktop = (api: Record<string, unknown>) => {
    ;(window as unknown as { pywebview: unknown }).pywebview = { api }
  }

  it('asks what to do when the file exists, and replaces only on Replace', async () => {
    const saveImage = vi.fn().mockResolvedValue({ status: 'exists', path: '/d/thumb.jpg' })
    const saveImageTo = vi.fn().mockResolvedValue({ status: 'saved', path: '/d/thumb.jpg' })
    desktop({ save_image: saveImage, save_image_to: saveImageTo })
    const askReplace = vi.fn().mockResolvedValue('replace')

    const result = await saveExportedImage(DATA_URL, 'thumb.jpg', { askReplace })

    expect(askReplace).toHaveBeenCalledWith('/d/thumb.jpg')
    expect(saveImageTo).toHaveBeenCalledWith(DATA_URL, '/d/thumb.jpg', 'replace')
    expect(result).toEqual({ savedPath: '/d/thumb.jpg' })
  })

  it('keeps both when asked', async () => {
    const saveImageTo = vi.fn().mockResolvedValue({ status: 'saved', path: '/d/thumb (2).jpg' })
    desktop({
      save_image: vi.fn().mockResolvedValue({ status: 'exists', path: '/d/thumb.jpg' }),
      save_image_to: saveImageTo,
    })
    const result = await saveExportedImage(DATA_URL, 'thumb.jpg', { askReplace: async () => 'keep' })
    expect(saveImageTo).toHaveBeenCalledWith(DATA_URL, '/d/thumb.jpg', 'keep_both')
    expect(result).toEqual({ savedPath: '/d/thumb (2).jpg' })
  })

  it('writes nothing when the user cancels or there is no one to ask', async () => {
    const saveImageTo = vi.fn()
    desktop({
      save_image: vi.fn().mockResolvedValue({ status: 'exists', path: '/d/thumb.jpg' }),
      save_image_to: saveImageTo,
    })
    expect(await saveExportedImage(DATA_URL, 'thumb.jpg', { askReplace: async () => 'cancel' })).toEqual({ savedPath: null })
    expect(await saveExportedImage(DATA_URL, 'thumb.jpg')).toEqual({ savedPath: null })
    expect(saveImageTo).not.toHaveBeenCalled()
  })

  it('throws the reason when the desktop side could not write the file', async () => {
    desktop({ save_image: vi.fn().mockResolvedValue({ status: 'error', message: 'Could not write /d/thumb.jpg: denied' }) })
    await expect(saveExportedImage(DATA_URL, 'thumb.jpg')).rejects.toThrow('Could not write /d/thumb.jpg: denied')
  })

  it('treats a missing answer from the desktop side as a failure, not as success or silence', async () => {
    desktop({ save_image: vi.fn().mockResolvedValue(undefined) })
    await expect(saveExportedImage(DATA_URL, 'thumb.jpg')).rejects.toThrow(/did not answer/)
  })
})
