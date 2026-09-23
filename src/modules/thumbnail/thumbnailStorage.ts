import type { SpeakerState, ThumbnailProject } from '../../types/thumbnail'
import { getDefaultLayout } from './layouts'
import { PROJECT_VERSION, defaultSpeakerName, newSpeakerId } from './thumbnailState'

const STORAGE_KEY_PREFIX = 'yt_thumb_proj_'

const V1_SPEAKER_KEYS = ['speaker1', 'speaker2']

/**
 * Brings a stored project up to the current format. v1 had exactly two fixed speakers,
 * `speaker1`/`speaker2`, and faked single-speaker mode by hiding `speaker2`; v2 has a
 * left-to-right `speakers` list and a `layoutId`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function migrateProject(raw: any): ThumbnailProject {
  if (raw.version >= PROJECT_VERSION && Array.isArray(raw.speakers)) return raw as ThumbnailProject

  const idFor: Record<string, string> = {}
  const speakers: SpeakerState[] = []
  for (const key of V1_SPEAKER_KEYS) {
    const old = raw[key]
    if (!old) continue
    const isOldSingleSpeakerMode = key === 'speaker2' && !old.visible && !old.sourceImageUrl
    if (isOldSingleSpeakerMode) continue
    idFor[key] = newSpeakerId()
    speakers.push({ ...old, id: idFor[key], name: defaultSpeakerName(speakers.length) })
  }

  const { speaker1: _s1, speaker2: _s2, ...rest } = raw
  return {
    ...rest,
    version: PROJECT_VERSION,
    background: { gradient: null, ...raw.background },
    speakers,
    layoutId: getDefaultLayout(speakers.length).id,
    layerOrder: (raw.layerOrder as string[])
      .filter((layer) => !V1_SPEAKER_KEYS.includes(layer) || idFor[layer])
      .map((layer) => idFor[layer] ?? layer),
  }
}
const INDEX_KEY = 'yt_thumb_projects_index'

interface ProjectIndexEntry {
  id: string
  name: string
  updatedAt: string
}

function getIndex(): ProjectIndexEntry[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveIndex(index: ProjectIndexEntry[]): void {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(index))
  } catch (err) {
    console.warn('Failed to save project index to localStorage', err)
  }
}

export function saveProjectToStorage(project: ThumbnailProject): void {
  const key = `${STORAGE_KEY_PREFIX}${project.id}`
  localStorage.setItem(key, JSON.stringify(project))

  const index = getIndex().filter((entry) => entry.id !== project.id)
  index.unshift({
    id: project.id,
    name: project.name,
    updatedAt: project.updatedAt,
  })
  saveIndex(index)
}

export function loadProjectFromStorage(id: string): ThumbnailProject | null {
  const key = `${STORAGE_KEY_PREFIX}${id}`
  const raw = localStorage.getItem(key)
  if (!raw) return null
  try {
    return migrateProject(JSON.parse(raw))
  } catch {
    return null
  }
}

export function listStoredProjects(): ProjectIndexEntry[] {
  const index = getIndex()
  return index.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

export function deleteStoredProject(id: string): void {
  const key = `${STORAGE_KEY_PREFIX}${id}`
  localStorage.removeItem(key)
  const index = getIndex().filter((entry) => entry.id !== id)
  saveIndex(index)
}

export function exportProjectToJSON(project: ThumbnailProject): string {
  return JSON.stringify(project, null, 2)
}

export function importProjectFromJSON(jsonStr: string): ThumbnailProject {
  let parsed: any
  try {
    parsed = JSON.parse(jsonStr)
  } catch (err) {
    throw new Error(`Invalid project JSON: ${err instanceof Error ? err.message : String(err)}`)
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid project JSON: Root must be an object')
  }

  const hasSpeakers = Array.isArray(parsed.speakers) || parsed.speaker1
  if (!parsed.id || !parsed.canvas || !hasSpeakers || !Array.isArray(parsed.layerOrder)) {
    throw new Error('Invalid project JSON: Missing required thumbnail project properties')
  }

  return migrateProject(parsed)
}
