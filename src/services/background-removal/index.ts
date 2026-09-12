import { defaultRemoverRegistry } from './registry'
import { ImglyBackgroundRemover } from './ImglyBackgroundRemover'
import { CachedBackgroundRemover } from './CachedBackgroundRemover'
import { MockBackgroundRemover } from './MockBackgroundRemover'

export * from './types'
export * from './MockBackgroundRemover'
export * from './CachedBackgroundRemover'
export * from './ImglyBackgroundRemover'
export * from './composite'
export * from './registry'

// Register standard removers into default registry
const cachedImgly = new CachedBackgroundRemover(new ImglyBackgroundRemover())
defaultRemoverRegistry.register(cachedImgly)
defaultRemoverRegistry.register(new MockBackgroundRemover())
