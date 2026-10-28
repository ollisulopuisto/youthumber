import { useCallback, useRef, useState } from 'react'
import { UndoTree } from './undoTree'

/** Uncapped, branching session history. Closing/reloading discards history, not saved projects. */
export function useUndoableState(initialValue) {
  const [session, setSession] = useState(() => new UndoTree(initialValue))
  const sessionRef = useRef(session)
  const treesRef = useRef(new Map())
  const [revision, render] = useState(0)
  const publish = useCallback(() => render((version) => version + 1), [])
  const update = useCallback((nextValueOrUpdater) => {
    let tree = sessionRef.current
    const next = typeof nextValueOrUpdater === 'function'
      ? nextValueOrUpdater(tree.value) : nextValueOrUpdater
    // Project switches have separate trees; undo never jumps into another project.
    if (next.id !== tree.value.id) {
      treesRef.current.set(tree.value.id, tree)
      tree = treesRef.current.get(next.id) ?? new UndoTree(next)
      sessionRef.current = tree
      setSession(tree)
    } else tree.commit(next)
    publish()
  }, [publish])
  const undo = useCallback(() => { sessionRef.current.undo(); publish() }, [publish])
  const redo = useCallback(() => { sessionRef.current.redo(); publish() }, [publish])
  const goto = useCallback((id) => { sessionRef.current.goto(Number(id)); publish() }, [publish])
  const getValue = useCallback(() => sessionRef.current.value, [])
  return {
    value: session.value, getValue, setValue: update, undo, redo,
    canUndo: session.canUndo, canRedo: session.canRedo,
    revision, historyHead: session.head, historyTips: session.tips(), gotoHistory: goto,
  }
}
