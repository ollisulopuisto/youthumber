/**
 * Saves an exported thumbnail. In the desktop app pywebview has downloads disabled, so a
 * browser-style <a download> silently does nothing there — use the native Save dialog
 * instead. In a normal browser tab, fall back to a regular download.
 *
 * The desktop side answers with { status: 'saved' | 'cancelled' | 'exists' | 'error', ... }.
 * When the chosen file exists, `askReplace(path)` resolves to 'replace', 'keep' or 'cancel';
 * without it the existing file is left alone. A failure throws an Error with the reason, so
 * the caller can show it. Resolves { savedPath } (null when nothing was written).
 */
export async function saveExportedImage(dataUrl, filename, { askReplace } = {}) {
  const api = typeof window !== 'undefined' ? window.pywebview?.api : null
  if (api?.save_image) {
    let result = readResult(await api.save_image(dataUrl, filename))
    if (result.status === 'exists') {
      const choice = askReplace ? await askReplace(result.path) : 'cancel'
      if (choice !== 'replace' && choice !== 'keep') return { savedPath: null }
      result = readResult(
        await api.save_image_to(dataUrl, result.path, choice === 'keep' ? 'keep_both' : 'replace')
      )
    }
    if (result.status === 'error') throw new Error(result.message || 'The file could not be saved.')
    return { savedPath: result.status === 'saved' ? result.path : null }
  }

  const link = document.createElement('a')
  link.download = filename
  link.href = dataUrl
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  return { downloaded: true }
}

/** An older desktop build answered with the saved path or null; a missing answer is a failure. */
function readResult(raw) {
  if (raw && typeof raw === 'object') return raw
  if (typeof raw === 'string') return { status: 'saved', path: raw }
  if (raw === null) return { status: 'cancelled' }
  return { status: 'error', message: 'The app did not answer the save request.' }
}
