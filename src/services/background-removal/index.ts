import { defaultRemoverRegistry } from './registry'
import { ImglyBackgroundRemover } from './ImglyBackgroundRemover'
import { CachedBackgroundRemover } from './CachedBackgroundRemover'
import { MockBackgroundRemover } from './MockBackgroundRemover'

import { LocalCoreMLRemover } from './LocalCoreMLRemover'

export * from './types'
export * from './MockBackgroundRemover'
export * from './CachedBackgroundRemover'
export * from './ImglyBackgroundRemover'
export * from './LocalCoreMLRemover'
export * from './composite'
export * from './registry'

// Register standard removers into default registry
const cachedImgly = new CachedBackgroundRemover(new ImglyBackgroundRemover())
const cachedCoreML = new CachedBackgroundRemover(new LocalCoreMLRemover())
defaultRemoverRegistry.register(cachedImgly)
defaultRemoverRegistry.register(cachedCoreML)
defaultRemoverRegistry.register(new MockBackgroundRemover())

/**
 * Automatically probes whether the high-performance local Apple Vision / Core ML
 * backend is available. If reachable, sets it as the active remover in the registry.
 */
export async function autoDetectBestRemover(): Promise<boolean> {
  const coreML = defaultRemoverRegistry.get('cached-coreml-local') || defaultRemoverRegistry.get('coreml-local')
  if (coreML && typeof coreML.isAvailable === 'function') {
    const isReady = await coreML.isAvailable()
    if (isReady) {
      defaultRemoverRegistry.setActive(coreML.id)
      return true
    }
  }
  return false
}

