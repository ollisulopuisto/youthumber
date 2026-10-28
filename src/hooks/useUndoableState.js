import { useCallback, useRef, useState } from 'react'

const GROUP_WINDOW_MS = 500
const HISTORY_LIMIT = 60
// Undo entries share every unchanged object and string with the live project, so an
// ordinary edit costs a few hundred bytes. An edit that makes a new image (a cutout from
// the mask sliders, a texture, an upload) leaves its multi-MB data URL in the entries
// before it; 60 such entries held hundreds of MB. Once the data URLs that only the
// history still references exceed this many characters, the oldest entries go.
const HISTORY_BYTE_BUDGET = 96 * 1024 * 1024
const HEAVY_STRING_MIN = 4096

/** Every string of HEAVY_STRING_MIN+ characters (data URLs) reachable from `value`. */
export function heavyStrings(value, out = new Set()) {
  if (typeof value === 'string') {
    if (value.length >= HEAVY_STRING_MIN) out.add(value)
  } else if (value && typeof value === 'object') {
    for (const child of Object.values(value)) heavyStrings(child, out)
  }
  return out
}

/**
 * The newest entries of `stack` whose data URLs, beyond those `live` shares, fit in
 * `budget` characters. The newest entry is always kept so one undo stays possible.
 */
export function trimHistory(stack, live, budget = HISTORY_BYTE_BUDGET) {
  const seen = heavyStrings(live)
  let bytes = 0
  for (let i = stack.length - 1; i >= 0; i--) {
    for (const text of heavyStrings(stack[i])) {
      if (seen.has(text)) continue
      seen.add(text)
      bytes += text.length
    }
    if (bytes > budget && i < stack.length - 1) return stack.slice(i + 1)
  }
  return stack
}

/** State with bounded undo/redo history; rapid edits are grouped into one step. */
export function useUndoableState(initialValue) {
  const [value, setValue] = useState(initialValue)
  const valueRef = useRef(value)
  const undoStack = useRef([])
  const redoStack = useRef([])
  const lastChangeAt = useRef(0)
  const [history, setHistory] = useState({ canUndo: false, canRedo: false })

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
      undoStack.current = trimHistory(undoStack.current, next)
    }
    lastChangeAt.current = now
    redoStack.current = []
    valueRef.current = next
    setValue(next)
    setHistory({ canUndo: undoStack.current.length > 0, canRedo: redoStack.current.length > 0 })
  }, [])

  const undo = useCallback(() => {
    const previous = undoStack.current.pop()
    if (!previous) return
    redoStack.current.push(valueRef.current)
    valueRef.current = previous
    lastChangeAt.current = 0
    setValue(previous)
    setHistory({ canUndo: undoStack.current.length > 0, canRedo: redoStack.current.length > 0 })
  }, [])

  const redo = useCallback(() => {
    const next = redoStack.current.pop()
    if (!next) return
    undoStack.current.push(valueRef.current)
    valueRef.current = next
    lastChangeAt.current = 0
    setValue(next)
    setHistory({ canUndo: undoStack.current.length > 0, canRedo: redoStack.current.length > 0 })
  }, [])

  // The latest value, including edits React hasn't rendered yet (for async work).
  const getValue = useCallback(() => valueRef.current, [])

  return {
    value,
    getValue,
    setValue: update,
    undo,
    redo,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
  }
}
