import type { BackgroundRemover } from './types'

export class BackgroundRemoverRegistry {
  private removers: Map<string, BackgroundRemover> = new Map()
  private activeId: string | null = null

  register(remover: BackgroundRemover): void {
    this.removers.set(remover.id, remover)
    if (!this.activeId) {
      this.activeId = remover.id
    }
  }

  get(id: string): BackgroundRemover | undefined {
    return this.removers.get(id)
  }

  list(): BackgroundRemover[] {
    return Array.from(this.removers.values())
  }

  setActive(id: string): void {
    if (!this.removers.has(id)) {
      throw new Error(`Remover with ID "${id}" is not registered`)
    }
    this.activeId = id
  }

  getActive(): BackgroundRemover {
    if (!this.activeId || !this.removers.has(this.activeId)) {
      throw new Error('No active BackgroundRemover available in registry')
    }
    return this.removers.get(this.activeId)!
  }
}

// Global default singleton registry
export const defaultRemoverRegistry = new BackgroundRemoverRegistry()
