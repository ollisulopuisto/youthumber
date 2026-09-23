import { describe, it, expect, beforeEach } from 'vitest'
import {
  saveProjectToStorage,
  loadProjectFromStorage,
  listStoredProjects,
  deleteStoredProject,
  exportProjectToJSON,
  importProjectFromJSON,
  migrateProject,
} from '../modules/thumbnail/thumbnailStorage'
import {
  createDefaultProject,
  setSpeakerSource,
  PROJECT_VERSION,
} from '../modules/thumbnail/thumbnailState'
import { getDefaultLayout } from '../modules/thumbnail/layouts'

function v1Speaker(id: 'speaker1' | 'speaker2', overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: id === 'speaker1' ? 'Speaker 1' : 'Speaker 2',
    sourceImageUrl: null,
    maskUrl: null,
    cutoutUrl: null,
    isProcessing: false,
    processingProgress: 0,
    error: null,
    visible: true,
    transform: { x: id === 'speaker1' ? 350 : 930, y: 420, scaleX: 0.9, scaleY: 0.9, rotation: 0 },
    ...overrides,
  }
}

function v1Project(speaker2Overrides: Record<string, unknown> = {}) {
  return {
    id: 'proj_old',
    name: 'Old Episode',
    createdAt: '2026-09-12T10:00:00.000Z',
    updatedAt: '2026-09-12T10:00:00.000Z',
    version: 1,
    canvas: { width: 1280, height: 720 },
    background: { type: 'solid', color: '#111827', imageUrl: null, transform: { x: 0, y: 0, scaleX: 1, scaleY: 1 } },
    speaker1: v1Speaker('speaker1', { sourceImageUrl: 'host-photo', cutoutUrl: 'host-cutout' }),
    speaker2: v1Speaker('speaker2', speaker2Overrides),
    text: { text: 'Old title', fontFamily: 'Montserrat', fontSize: 64, fontWeight: 'bold', textAlign: 'center', fillColor: '#FFF', transform: { x: 640, y: 110, scaleX: 1, scaleY: 1, rotation: 0 }, visible: true },
    layerOrder: ['background', 'speaker2', 'speaker1', 'text'],
  }
}

describe('Thumbnail Storage & Serialization', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('saves and reloads a project from storage without loss of properties', () => {
    let project = createDefaultProject('Episode 42')
    const id = project.speakers[0].id
    project = setSpeakerSource(project, id, 'data:image/jpeg;base64,speakerPhoto')

    saveProjectToStorage(project)
    const loaded = loadProjectFromStorage(project.id)

    expect(loaded).toEqual(project)
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
    expect(list[0].id).toBe(p2.id)
  })

  it('deletes stored project', () => {
    const p = createDefaultProject('To Delete')
    saveProjectToStorage(p)
    deleteStoredProject(p.id)
    expect(loadProjectFromStorage(p.id)).toBeNull()
  })

  it('exports and imports project as JSON string', () => {
    const project = createDefaultProject('Exportable')
    expect(importProjectFromJSON(exportProjectToJSON(project))).toEqual(project)
  })

  it('throws helpful error on invalid JSON import', () => {
    expect(() => importProjectFromJSON('{ invalid json')).toThrow(/Invalid project JSON/)
    expect(() => importProjectFromJSON('{"id": "x"}')).toThrow(/Invalid project JSON/)
  })

  describe('migrating v1 (speaker1/speaker2) projects', () => {
    it('turns both speakers into a two-speaker list, keeping photos and transforms', () => {
      const migrated = migrateProject(v1Project({ sourceImageUrl: 'guest-photo' }))

      expect(migrated.version).toBe(PROJECT_VERSION)
      expect(migrated.speakers).toHaveLength(2)
      expect(migrated.speakers[0]).toMatchObject({ name: 'Host', sourceImageUrl: 'host-photo', cutoutUrl: 'host-cutout' })
      expect(migrated.speakers[0].transform.x).toBe(350)
      expect(migrated.speakers[1]).toMatchObject({ name: 'Guest', sourceImageUrl: 'guest-photo' })
      expect(migrated.layoutId).toBe(getDefaultLayout(2).id)
      expect('speaker1' in migrated).toBe(false)
    })

    it('keeps the layer order, mapped to the new speaker ids', () => {
      const migrated = migrateProject(v1Project())
      const [host, guest] = migrated.speakers.map((s) => s.id)

      expect(migrated.layerOrder).toEqual(['background', guest, host, 'text'])
    })

    it('treats a hidden, empty speaker2 as the old single-speaker mode', () => {
      const migrated = migrateProject(v1Project({ visible: false }))

      expect(migrated.speakers).toHaveLength(1)
      expect(migrated.layoutId).toBe(getDefaultLayout(1).id)
      expect(migrated.layerOrder).toEqual(['background', migrated.speakers[0].id, 'text'])
    })

    it('keeps a hidden speaker2 that still has a photo', () => {
      const migrated = migrateProject(v1Project({ visible: false, sourceImageUrl: 'guest-photo' }))

      expect(migrated.speakers).toHaveLength(2)
      expect(migrated.speakers[1].visible).toBe(false)
    })

    it('fills in a missing gradient field on old backgrounds', () => {
      expect(migrateProject(v1Project()).background.gradient).toBeNull()
    })

    it('leaves current-version projects untouched', () => {
      const project = createDefaultProject()
      expect(migrateProject(project)).toBe(project)
    })

    it('migrates on load from storage and on JSON import', () => {
      localStorage.setItem('yt_thumb_proj_proj_old', JSON.stringify(v1Project()))
      expect(loadProjectFromStorage('proj_old')?.speakers).toHaveLength(2)
      expect(importProjectFromJSON(JSON.stringify(v1Project())).speakers).toHaveLength(2)
    })
  })
})
