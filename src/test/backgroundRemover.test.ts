import { describe, it, expect, vi } from 'vitest'
import { MockBackgroundRemover } from '../services/background-removal/MockBackgroundRemover'
import type { BackgroundRemover, RemovalResult } from '../services/background-removal/types'

describe('BackgroundRemover Contract & MockBackgroundRemover', () => {
  it('implements the BackgroundRemover interface with id and name', () => {
    const remover: BackgroundRemover = new MockBackgroundRemover()
    expect(remover.id).toBe('mock-remover')
    expect(typeof remover.name).toBe('string')
    expect(remover.name.length).toBeGreaterThan(0)
  })

  it('reports availability asynchronously', async () => {
    const remover = new MockBackgroundRemover()
    const available = await remover.isAvailable()
    expect(available).toBe(true)
  })

  it('removes background returning both cutout image and alpha mask', async () => {
    const remover = new MockBackgroundRemover()
    const sampleInput = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    
    const result: RemovalResult = await remover.remove(sampleInput)

    expect(result).toBeDefined()
    expect(result.image).toBeDefined()
    expect(result.mask).toBeDefined()
    expect(result.metadata?.backendId).toBe('mock-remover')
  })

  it('invokes progress callback during processing', async () => {
    const remover = new MockBackgroundRemover()
    const onProgress = vi.fn()
    const sampleInput = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

    await remover.remove(sampleInput, { onProgress })

    expect(onProgress).toHaveBeenCalled()
    // Should have called with progress up to 100
    const calls = onProgress.mock.calls
    const progressValues = calls.map(call => call[0])
    expect(progressValues[progressValues.length - 1]).toBe(100)
  })

  it('allows custom mock behaviors for testing error states', async () => {
    const remover = new MockBackgroundRemover({ shouldFail: true, errorMessage: 'Local ML failed' })
    const sampleInput = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

    await expect(remover.remove(sampleInput)).rejects.toThrow('Local ML failed')
  })
})
