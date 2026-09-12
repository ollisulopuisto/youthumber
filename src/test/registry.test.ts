import { describe, it, expect, beforeEach } from 'vitest'
import { BackgroundRemoverRegistry } from '../services/background-removal/registry'
import { MockBackgroundRemover } from '../services/background-removal/MockBackgroundRemover'

describe('BackgroundRemoverRegistry', () => {
  let registry: BackgroundRemoverRegistry

  beforeEach(() => {
    registry = new BackgroundRemoverRegistry()
  })

  it('allows registering and retrieving removers', () => {
    const mock = new MockBackgroundRemover({ id: 'custom-mock', name: 'Custom Mock' })
    registry.register(mock)

    expect(registry.get('custom-mock')).toBe(mock)
    expect(registry.list().length).toBe(1)
  })

  it('sets and gets the active remover', () => {
    const mock1 = new MockBackgroundRemover({ id: 'm1', name: 'Remover 1' })
    const mock2 = new MockBackgroundRemover({ id: 'm2', name: 'Remover 2' })
    registry.register(mock1)
    registry.register(mock2)

    registry.setActive('m2')
    expect(registry.getActive().id).toBe('m2')
  })

  it('throws error when setting unknown active remover', () => {
    expect(() => registry.setActive('non-existent')).toThrow(/not registered/)
  })
})
