import { expect, it } from 'vitest'
import { EffectText } from '../modules/thumbnail/effectText'
it('paints the outline behind the glyph fill so font stroke paths cannot cut the face', () => {
  expect(new EffectText('Headline').paintFirst).toBe('stroke')
})
