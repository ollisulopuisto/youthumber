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

/**
 * Scans a local video file, groups the faces in it into `numPeople` people, and
 * returns `[{ frameCount, frames: [{ timestampSeconds, score, image }] }]` — up to
 * `framesPerPerson` face-crop frames per person, best first. Fetch a chosen frame at
 * full resolution with grabFullResolutionFrame.
 */
export async function scanVideoForSpeakers(path, { numPeople, framesPerPerson } = {}) {
  const baseUrl = resolveBaseUrl()
  const body = { path }
  if (numPeople != null) body.numPeople = numPeople
  if (framesPerPerson != null) body.framesPerPerson = framesPerPerson

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

const FRAMES_SHOWN = 12

/**
 * A person's frames in one sort mode ('quality' | 'expression' | 'gesture'), best
 * first, trimmed to what the picker grid shows. The scan sends the top frames of every
 * mode, so switching modes needs no rescan.
 */
export function framesSortedBy(person, mode) {
  return [...person.frames]
    .sort((a, b) => (b.scores?.[mode] ?? 0) - (a.scores?.[mode] ?? 0))
    .slice(0, FRAMES_SHOWN)
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
