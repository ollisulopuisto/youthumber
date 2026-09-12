import type { ThumbnailProject } from '../../types/thumbnail'

const STORAGE_KEY_PREFIX = 'yt_thumb_proj_'
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
    return JSON.parse(raw) as ThumbnailProject
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

  if (!parsed.id || !parsed.canvas || !parsed.speaker1 || !parsed.speaker2) {
    throw new Error('Invalid project JSON: Missing required thumbnail project properties')
  }

  return parsed as ThumbnailProject
}
