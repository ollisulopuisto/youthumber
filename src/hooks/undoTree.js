/** Session-only undo. Nodes retain immutable project values with structural sharing.
 * No pruning or grouping: every accepted change has its own reachable node.
 */
export class UndoTree {
  constructor(value) {
    this.nodes = new Map([[0, { id: 0, parent: null, value, label: 'Initial state' }]])
    this.head = 0
    this.nextId = 1
    this.preferred = new Map()
  }
  get value() { return this.nodes.get(this.head).value }
  get canUndo() { return this.nodes.get(this.head).parent !== null }
  get canRedo() { return this.preferred.has(this.head) }
  commit(value) {
    if (value === this.value) return
    const id = this.nextId++
    this.nodes.set(id, { id, parent: this.head, value, label: `Edit ${id}` })
    this.preferred.set(this.head, id)
    this.head = id
  }
  undo() {
    const parent = this.nodes.get(this.head).parent
    if (parent === null) return
    this.preferred.set(parent, this.head)
    this.head = parent
  }
  redo() {
    if (this.canRedo) this.head = this.preferred.get(this.head)
  }
  goto(id) {
    if (!this.nodes.has(id)) return
    let node = this.nodes.get(id)
    while (node.parent !== null) {
      this.preferred.set(node.parent, node.id)
      node = this.nodes.get(node.parent)
    }
    this.head = id
  }
  tips() {
    const parents = new Set(Array.from(this.nodes.values(), (node) => node.parent))
    return Array.from(this.nodes.values()).filter((node) => !parents.has(node.id) || node.id === this.head)
  }
}
