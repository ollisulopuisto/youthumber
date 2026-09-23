import { describe, it, expect } from 'vitest'
import {
  LAYOUT_PRESETS,
  MAX_SPEAKERS,
  getDefaultLayout,
  getLayout,
  getLayoutsForCount,
  positionLabels,
} from '../modules/thumbnail/layouts'

describe('Layout registry', () => {
  it('has at least one layout for every supported speaker count', () => {
    for (let n = 1; n <= MAX_SPEAKERS; n++) {
      expect(getLayoutsForCount(n).length).toBeGreaterThanOrEqual(1)
      expect(getDefaultLayout(n).speakerCount).toBe(n)
    }
  })

  it('gives every layout exactly one slot per speaker', () => {
    for (const layout of LAYOUT_PRESETS) {
      expect(layout.slots).toHaveLength(layout.speakerCount)
    }
  })

  it('has unique layout ids so presets can be added without collisions', () => {
    const ids = LAYOUT_PRESETS.map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('keeps the three existing two-speaker layouts', () => {
    expect(getLayoutsForCount(2).map((l) => l.id)).toEqual(
      expect.arrayContaining(['side-by-side', 'host-guest-spotlight', 'dramatic-clash'])
    )
  })

  it('orders each layout’s slots left to right', () => {
    for (const layout of LAYOUT_PRESETS) {
      const xs = layout.slots.map((s) => s.frame.centerX)
      expect([...xs].sort((a, b) => a - b)).toEqual(xs)
    }
  })

  it('looks up a layout by id', () => {
    expect(getLayout('side-by-side')?.speakerCount).toBe(2)
    expect(getLayout('nope')).toBeUndefined()
  })

  it('labels positions left to right for each count', () => {
    expect(positionLabels(1)).toEqual(['Centre'])
    expect(positionLabels(2)).toEqual(['Left', 'Right'])
    expect(positionLabels(3)).toEqual(['Left', 'Centre', 'Right'])
    expect(positionLabels(4)).toEqual(['Left', 'Centre-left', 'Centre-right', 'Right'])
  })
})
