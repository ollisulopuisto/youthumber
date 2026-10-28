import { expect, it, vi } from 'vitest'
import { preferActiveTarget } from '../modules/thumbnail/selectionTarget'
it('uses Fabric 7 point APIs and preserves target-info shape for an active hit', () => {
  const active = { findControl: vi.fn(() => null) }
  const scene = { x: 4, y: 5 }; const viewport = { x: 8, y: 10 }
  const canvas = { getActiveObject: () => active, getScenePoint: () => scene,
    getViewportPoint: () => viewport, searchPossibleTargets: vi.fn(() => ({ target: active, subTargets: [] })) }
  const other = {}; const result = preferActiveTarget(canvas, {}, () => ({ target: other, currentTarget: other, subTargets: [], currentSubTargets: [] }))
  expect(result.target).toBe(active); expect(result.currentTarget).toBe(other)
  expect(canvas.searchPossibleTargets).toHaveBeenCalledWith([active], scene)
  expect(active.findControl).toHaveBeenCalledWith(viewport)
})
it('keeps the topmost fallback when the active object was not hit', () => {
  const expected = { target: {}, subTargets: [] }
  const canvas = { getActiveObject: () => ({ findControl: () => null }), getScenePoint: () => ({}),
    getViewportPoint: () => ({}), searchPossibleTargets: () => ({ subTargets: [] }) }
  expect(preferActiveTarget(canvas, {}, () => expected)).toBe(expected)
})
