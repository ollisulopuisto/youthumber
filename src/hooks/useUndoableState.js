import { useCallback, useRef, useState } from 'react'

const GROUP_WINDOW_MS = 500
const HISTORY_LIMIT = 60

/** State with bounded undo/redo history; rapid edits are grouped into one step. */
export function useUndoableState(initialValue) {
  const [value, setValue] = useState(initialValue)
  const valueRef = useRef(value)
  const undoStack = useRef([])
  const redoStack = useRef([])
  const lastChangeAt = useRef(0)
  const [, setRevision] = useState(0)

  const update = useCallback((nextValueOrUpdater) => {
    const previous = valueRef.current
    const next = typeof nextValueOrUpdater === 'function'
      ? nextValueOrUpdater(previous)
      : nextValueOrUpdater
    if (next === previous) return

    const now = Date.now()
    if (!lastChangeAt.current || now - lastChangeAt.current > GROUP_WINDOW_MS) {
      undoStack.current.push(previous)
      if (undoStack.current.length > HISTORY_LIMIT) undoStack.current.shift()
    }
    lastChangeAt.current = now
    redoStack.current = []
    valueRef.current = next
    setValue(next)
    setRevision((count) => count + 1)
  }, [])

  const undo = useCallback(() => {
    const previous = undoStack.current.pop()
    if (!previous) return
    redoStack.current.push(valueRef.current)
    valueRef.current = previous
    lastChangeAt.current = 0
    setValue(previous)
    setRevision((count) => count + 1)
  }, [])

  const redo = useCallback(() => {
    const next = redoStack.current.pop()
    if (!next) return
    undoStack.current.push(valueRef.current)
    valueRef.current = next
    lastChangeAt.current = 0
    setValue(next)
    setRevision((count) => count + 1)
  }, [])

  // The latest value, including edits React hasn't rendered yet (for async work).
  const getValue = useCallback(() => valueRef.current, [])

  return {
    value,
    getValue,
    setValue: update,
    undo,
    redo,
    canUndo: undoStack.current.length > 0,
    canRedo: redoStack.current.length > 0,
  }
}
