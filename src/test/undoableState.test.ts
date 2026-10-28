import { describe, it, expect } from 'vitest'
import { UndoTree } from '../hooks/undoTree'

describe('session undo tree', () => {
  it('retains every accepted edit beyond the old cap and heavy-image budget', () => {
    const tree = new UndoTree({ n: 0 })
    for (let n = 1; n <= 1000; n++) tree.commit({ n })
    for (let n = 999; n >= 0; n--) { tree.undo(); expect(tree.value.n).toBe(n) }
    tree.undo(); expect(tree.value.n).toBe(0)
    for (let n = 1; n <= 1000; n++) { tree.redo(); expect(tree.value.n).toBe(n) }
    expect(tree.nodes.size).toBe(1001)
  })
  it('keeps both branch tips accessible and redoes the last chosen branch', () => {
    const tree = new UndoTree('root')
    tree.commit('A'); tree.commit('B'); const b = tree.head
    tree.undo(); tree.commit('C'); const c = tree.head
    expect(tree.tips().map((x) => x.id)).toEqual([b, c])
    tree.goto(b); expect(tree.value).toBe('B')
    tree.undo(); tree.redo(); expect(tree.value).toBe('B')
    tree.goto(c); expect(tree.value).toBe('C')
    tree.goto(99999); expect(tree.value).toBe('C')
  })
  it('shares unchanged image values and does not mutate old snapshots', () => {
    const image = 'data:image/png;base64,' + 'x'.repeat(100000)
    const tree = new UndoTree({ image, text: 'old' })
    tree.commit({ ...tree.value, text: 'new' })
    tree.undo(); expect(tree.value).toEqual({ image, text: 'old' })
  })
})
