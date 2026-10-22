import { describe, it, expect } from 'vitest'
import { heavyStrings, trimHistory } from '../hooks/useUndoableState'

// A cutout data URL is a few MB; anything that size is what the history budget counts.
const dataUrl = (tag: string) => `data:image/png;base64,${tag}`.padEnd(10_000, 'A')

const project = (cutout: string, extra = {}) => ({
  name: 'Show',
  speakers: [{ id: 'spk_1', cutoutUrl: cutout, transform: { x: 1 } }],
  background: { imageUrl: null },
  ...extra,
})

describe('heavyStrings', () => {
  it('collects data-URL-sized strings anywhere in the project, nothing smaller', () => {
    const big = dataUrl('a')
    const found = heavyStrings(project(big, { bugs: [{ imageUrl: dataUrl('b') }] }))
    expect(found.has(big)).toBe(true)
    expect(found.size).toBe(2)
    expect(found.has('Show')).toBe(false)
  })
})

describe('trimHistory', () => {
  it('keeps entries that only share images with the live project', () => {
    const cutout = dataUrl('same')
    // Twenty transform edits: every entry points at the same cutout string.
    const stack = Array.from({ length: 20 }, (_, i) => project(cutout, { tick: i }))
    const live = project(cutout, { tick: 20 })
    expect(trimHistory(stack, live, 15_000)).toBe(stack)
  })

  it('drops the oldest entries once the images only they hold exceed the budget', () => {
    // Each mask-slider tick left a different cutout behind.
    const stack = Array.from({ length: 5 }, (_, i) => project(dataUrl(`v${i}`)))
    const live = project(dataUrl('live'))
    const kept = trimHistory(stack, live, 25_000)
    expect(kept).toEqual(stack.slice(3))
  })

  it('always keeps the newest entry, even when it alone is over budget', () => {
    const stack = [project(dataUrl('old')), project(dataUrl('new'))]
    const kept = trimHistory(stack, project(dataUrl('live')), 100)
    expect(kept).toEqual([stack[1]])
  })
})
