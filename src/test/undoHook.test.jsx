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
it('renders undo availability and preserves grouped edits, redo and branching', () => {
  node = document.createElement('div'); document.body.append(node); root = createRoot(node)
  act(() => root.render(<Probe />))
  expect(node.textContent).toBe('first:false:false')
  vi.spyOn(Date, 'now').mockReturnValue(1000)
  act(() => state.setValue({ name: 'second' }))
  expect(node.textContent).toBe('second:true:false')
  act(() => state.setValue({ name: 'third' }))
  act(() => state.undo())
  expect(node.textContent).toBe('first:false:true')
  act(() => state.redo())
  expect(node.textContent).toBe('third:true:false')
  act(() => state.undo())
  act(() => state.setValue({ name: 'branch' }))
  expect(node.textContent).toBe('branch:true:false')
  expect(state.getValue()).toEqual({ name: 'branch' })
})
