/**
 * Native (desktop-app-only) video scanning: pick a local video file via pywebview's
 * native file dialog, then ask the local CoreML backend to sample it at intervals
 * and score each frame with Apple Vision to find well-framed, in-focus faces.
 */

function resolveBaseUrl() {
  if (
    typeof window !== 'undefined' &&
    window.location?.origin?.startsWith('http') &&
    !window.location.origin.includes(':5173')
  ) {
    return window.location.origin.replace(/\/+$/, '')
  }
  return 'http://127.0.0.1:5055'
}

export function isDesktopVideoScanAvailable() {
  return typeof window !== 'undefined' && !!window.pywebview?.api?.pick_video_file
}

/** Opens the native file picker. Returns the selected absolute path, or null if cancelled. */
export async function pickVideoFile() {
  if (!isDesktopVideoScanAvailable()) {
    throw new Error('The native video picker is only available in the YouThumber desktop app')
  }
  return window.pywebview.api.pick_video_file()
}

async function parseErrorResponse(response) {
  const text = await response.text().catch(() => response.statusText)
  try {
    const json = JSON.parse(text)
    return json.detail || text
  } catch {
    return text
  }
}

/** Scans a local video file for the best-scoring, face-containing frames. */
export async function scanVideoForBestFrames(path, { intervalSeconds, maxCandidates } = {}) {
  const baseUrl = resolveBaseUrl()
  const body = { path }
  if (intervalSeconds != null) body.intervalSeconds = intervalSeconds
  if (maxCandidates != null) body.maxCandidates = maxCandidates

  const response = await fetch(`${baseUrl}/scan-video`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(`Video scan failed: ${await parseErrorResponse(response)}`)
  }

  const data = await response.json()
  return data.candidates
}

/**
 * Scans a local video file for every distinct person appearing in it, clustering
 * detected faces by visual identity, and returns each person's best-scoring frame
 * (as a small crop for identification — fetch the full frame separately via
 * grabFullResolutionFrame once the user assigns a person to a speaker slot).
 */
export async function scanVideoForSpeakers(path, { intervalSeconds, maxPeople } = {}) {
  const baseUrl = resolveBaseUrl()
  const body = { path }
  if (intervalSeconds != null) body.intervalSeconds = intervalSeconds
  if (maxPeople != null) body.maxPeople = maxPeople

  const response = await fetch(`${baseUrl}/scan-video-speakers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(`Video scan failed: ${await parseErrorResponse(response)}`)
  }

  const data = await response.json()
  return data.people
}

/** Grabs a single full-resolution frame from a video at the given timestamp. */
export async function grabFullResolutionFrame(path, timestampSeconds) {
  const baseUrl = resolveBaseUrl()
  const response = await fetch(`${baseUrl}/grab-frame`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, timestampSeconds }),
  })

  if (!response.ok) {
    throw new Error(`Frame grab failed: ${await parseErrorResponse(response)}`)
  }

  const data = await response.json()
  return data.image
}
