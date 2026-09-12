import { describe, it, expect } from 'vitest'
import { PRESET_TEMPLATES } from '../modules/thumbnail/templates'
import { createDefaultProject, applyTemplateToProject } from '../modules/thumbnail/thumbnailState'

describe('Composition Templates', () => {
  it('provides at least 3 distinct composition presets', () => {
    expect(PRESET_TEMPLATES.length).toBeGreaterThanOrEqual(3)
  })

  it('each template defines complete transforms for both speakers and text', () => {
    for (const t of PRESET_TEMPLATES) {
      expect(t.id).toBeDefined()
      expect(t.name).toBeDefined()
      expect(t.speaker1Transform).toBeDefined()
      expect(t.speaker2Transform).toBeDefined()
      expect(t.textStyleAndPosition).toBeDefined()
    }
  })

  it('can be applied to any project cleanly', () => {
    const project = createDefaultProject()
    const applied = applyTemplateToProject(project, PRESET_TEMPLATES[0])

    expect(applied.speaker1.transform).toEqual(PRESET_TEMPLATES[0].speaker1Transform)
    expect(applied.speaker2.transform).toEqual(PRESET_TEMPLATES[0].speaker2Transform)
  })
})
