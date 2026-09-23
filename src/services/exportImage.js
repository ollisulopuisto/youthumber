/**
 * Saves an exported thumbnail. In the desktop app pywebview has downloads disabled, so a
 * browser-style <a download> silently does nothing there — use the native Save dialog
 * instead. In a normal browser tab, fall back to a regular download.
 */
export async function saveExportedImage(dataUrl, filename) {
  const saveImage = typeof window !== 'undefined' ? window.pywebview?.api?.save_image : null
  if (saveImage) {
    const savedPath = await saveImage(dataUrl, filename)
    return { savedPath: savedPath || null }
  }

  const link = document.createElement('a')
  link.download = filename
  link.href = dataUrl
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  return { downloaded: true }
}
