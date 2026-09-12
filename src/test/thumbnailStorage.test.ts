import { describe, it, expect, beforeEach } from 'vitest'
import {
  saveProjectToStorage,
  loadProjectFromStorage,
  listStoredProjects,
  deleteStoredProject,
  exportProjectToJSON,
  importProjectFromJSON,
} from '../modules/thumbnail/thumbnailStorage'
import { createDefaultProject, setSpeakerSource } from '../modules/thumbnail/thumbnailState'

describe('Thumbnail Storage & Serialization', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('saves and reloads a project from storage without loss of properties', () => {
    let project = createDefaultProject('Episode 42')
    project = setSpeakerSource(project, 'speaker1', 'data:image/jpeg;base64,speakerPhoto')
    project.speaker1.cutoutUrl = 'data:image/png;base64,cutout'
    project.speaker1.maskUrl = 'data:image/png;base64,mask'
    project.speaker1.removerId = 'imgly-wasm'

    saveProjectToStorage(project)

    const loaded = loadProjectFromStorage(project.id)
    expect(loaded).not.toBeNull()
    expect(loaded?.id).toBe(project.id)
    expect(loaded?.name).toBe('Episode 42')
    expect(loaded?.speaker1.sourceImageUrl).toBe('data:image/jpeg;base64,speakerPhoto')
    expect(loaded?.speaker1.cutoutUrl).toBe('data:image/png;base64,cutout')
    expect(loaded?.speaker1.maskUrl).toBe('data:image/png;base64,mask')
    expect(loaded?.canvas.width).toBe(1280)
    expect(loaded?.canvas.height).toBe(720)
  })

  it('lists stored projects sorted by recent update', () => {
    const p1 = createDefaultProject('Project 1')
    p1.updatedAt = '2026-09-10T10:00:00.000Z'
    const p2 = createDefaultProject('Project 2')
    p2.updatedAt = '2026-09-12T10:00:00.000Z'

    saveProjectToStorage(p1)
    saveProjectToStorage(p2)

    const list = listStoredProjects()
    expect(list.length).toBe(2)
    expect(list[0].id).toBe(p2.id) // most recent first
  })

  it('deletes stored project', () => {
    const p = createDefaultProject('To Delete')
    saveProjectToStorage(p)
    expect(loadProjectFromStorage(p.id)).not.toBeNull()

    deleteStoredProject(p.id)
    expect(loadProjectFromStorage(p.id)).toBeNull()
  })

  it('exports and imports project as JSON string', () => {
    const project = createDefaultProject('Exportable')
    const json = exportProjectToJSON(project)
    const imported = importProjectFromJSON(json)

    expect(imported.id).toBe(project.id)
    expect(imported.name).toBe(project.name)
    expect(imported.canvas.width).toBe(1280)
  })

  it('throws helpful error on invalid JSON import', () => {
    expect(() => importProjectFromJSON('{ invalid json')).toThrow(/Invalid project JSON/)
  })
})
