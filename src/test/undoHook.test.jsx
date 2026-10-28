import { act, useLayoutEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { useUndoableState } from '../hooks/useUndoableState'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
let root
let node
let state
function Probe() {
  const current = useUndoableState({ name: 'first' })
  useLayoutEffect(() => { state = current })
  return <output>{current.value.name}:{String(current.canUndo)}:{String(current.canRedo)}</output>
}
afterEach(() => { act(() => root?.unmount()); node?.remove(); vi.restoreAllMocks() })
it('renders undo availability and preserves individual edits, redo and branching', () => {
  node = document.createElement('div'); document.body.append(node); root = createRoot(node)
  act(() => root.render(<Probe />))
  expect(node.textContent).toBe('first:false:false')
  vi.spyOn(Date, 'now').mockReturnValue(1000)
  act(() => state.setValue({ name: 'second' }))
  expect(node.textContent).toBe('second:true:false')
  act(() => state.setValue({ name: 'third' }))
  act(() => state.undo())
  expect(node.textContent).toBe('second:true:true')
  act(() => state.redo())
  expect(node.textContent).toBe('third:true:false')
  act(() => state.undo())
  const oldTip = state.historyHead + 1
  act(() => state.setValue({ name: 'branch' }))
  expect(node.textContent).toBe('branch:true:false')
  expect(state.getValue()).toEqual({ name: 'branch' })
  act(() => state.gotoHistory(oldTip))
  expect(state.getValue()).toEqual({ name: 'third' })
})

it('keeps project trees isolated across project switches in one session', () => {
  node = document.createElement('div'); document.body.append(node); root = createRoot(node)
  act(() => root.render(<Probe />))
  act(() => state.setValue({ id: 'A', name: 'A start' }))
  act(() => state.setValue({ id: 'A', name: 'A edit' }))
  act(() => state.setValue({ id: 'B', name: 'B start' }))
  expect(state.canUndo).toBe(false)
  act(() => state.setValue({ id: 'B', name: 'B edit' }))
  act(() => state.setValue({ id: 'A', name: 'stale storage value' }))
  expect(state.value.name).toBe('A edit')
  act(() => state.undo())
  expect(state.value.name).toBe('A start')
})
