const DEFAULT_PROJECT_NAME = 'YouTube Thumbnail'

function cleanPart(value) {
  return String(value ?? '')
    // Control characters are not allowed in file names, hence the range.
    // eslint-disable-next-line no-control-regex
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Build a useful export name from the show, episode/project name and visible text. */
export function createExportFilename(project, width, height, format = 'jpeg') {
  const candidates = [
    project.showPresetName,
    project.name?.trim() === DEFAULT_PROJECT_NAME ? '' : project.name,
    project.text?.visible ? project.text.text : '',
    ...(project.textLayers ?? []).filter((layer) => layer.visible).map((layer) => layer.text),
  ]
  const parts = []
  const seen = new Set()
  for (const candidate of candidates) {
    const part = cleanPart(candidate)
    const key = part.toLocaleLowerCase()
    if (part && !seen.has(key)) {
      seen.add(key)
      parts.push(part)
    }
  }
  const suffix = `${width}x${height}.${format === 'png' ? 'png' : 'jpg'}`
  const prefix = parts.join('-').slice(0, Math.max(1, 150 - suffix.length - 1)).replace(/-+$/g, '')
  return `${prefix ? `${prefix}-` : ''}${suffix}`
}
