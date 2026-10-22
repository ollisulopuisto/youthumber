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
const DB_NAME = 'youthumber'
const PROJECTS = 'projects' // id -> full project (can be tens of MB with photos)
const INDEX = 'index' // id -> { id, name, updatedAt }, so listing never loads projects

interface ProjectIndexEntry {
  id: string
  name: string
  updatedAt: string
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(PROJECTS)
      request.result.createObjectStore(INDEX)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  }).then(async (db) => {
    await migrateFromLocalStorage(db)
    return db
  })
  // A failed open must not be cached, or every later save would fail too.
  dbPromise.catch(() => {
    dbPromise = null
  })
  return dbPromise
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

function result<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/**
 * Projects used to live in localStorage, which holds ~5 MB and was wiped on every
 * desktop launch. Moves any left there into IndexedDB, once, then clears them.
 */
async function migrateFromLocalStorage(db: IDBDatabase): Promise<void> {
  let legacy: ProjectIndexEntry[]
  try {
    const raw = localStorage.getItem(INDEX_KEY)
    if (!raw) return
    legacy = JSON.parse(raw)
  } catch {
    return
  }
  const tx = db.transaction([PROJECTS, INDEX], 'readwrite')
  for (const entry of legacy) {
    const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${entry.id}`)
    if (!stored) continue
    try {
      tx.objectStore(PROJECTS).put(JSON.parse(stored), entry.id)
      tx.objectStore(INDEX).put(entry, entry.id)
    } catch {
      // A corrupt legacy project is skipped, not allowed to block the rest.
    }
  }
  await done(tx)
  for (const entry of legacy) localStorage.removeItem(`${STORAGE_KEY_PREFIX}${entry.id}`)
  localStorage.removeItem(INDEX_KEY)
}

export async function saveProjectToStorage(project: ThumbnailProject): Promise<void> {
  const db = await openDb()
  const tx = db.transaction([PROJECTS, INDEX], 'readwrite')
  tx.objectStore(PROJECTS).put(project, project.id)
  tx.objectStore(INDEX).put(
    { id: project.id, name: project.name, updatedAt: project.updatedAt },
    project.id
  )
  await done(tx)
}

export async function loadProjectFromStorage(id: string): Promise<ThumbnailProject | null> {
  try {
    const db = await openDb()
    const stored = await result(db.transaction(PROJECTS).objectStore(PROJECTS).get(id))
    return stored ? migrateProject(stored) : null
  } catch {
    return null
  }
}

export async function listStoredProjects(): Promise<ProjectIndexEntry[]> {
  try {
    const db = await openDb()
    const entries: ProjectIndexEntry[] = await result(
      db.transaction(INDEX).objectStore(INDEX).getAll()
    )
    return entries.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  } catch {
    return []
  }
}

export async function deleteStoredProject(id: string): Promise<void> {
  const db = await openDb()
  const tx = db.transaction([PROJECTS, INDEX], 'readwrite')
  tx.objectStore(PROJECTS).delete(id)
  tx.objectStore(INDEX).delete(id)
  await done(tx)
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
