import { describe, it, expect } from 'vitest'
import { framesSortedBy } from '../services/videoScan'

const frame = (t: number, quality: number, expression: number, gesture: number) => ({
  timestampSeconds: t,
  image: `img-${t}`,
  scores: { quality, expression, gesture },
})

describe('framesSortedBy', () => {
  const person = {
    frameCount: 40,
    frames: [frame(5, 0.9, 0.1, 0), frame(10, 0.5, 0.9, 0.2), frame(15, 0.4, 0.3, 0.8)],
  }

  it('orders a person’s frames by the chosen score, best first', () => {
    expect(framesSortedBy(person, 'quality').map((f) => f.timestampSeconds)).toEqual([5, 10, 15])
    expect(framesSortedBy(person, 'expression').map((f) => f.timestampSeconds)).toEqual([10, 15, 5])
    expect(framesSortedBy(person, 'gesture').map((f) => f.timestampSeconds)).toEqual([15, 10, 5])
  })

  it('shows at most 12 frames', () => {
    const many = { frameCount: 99, frames: Array.from({ length: 36 }, (_, i) => frame(i, i / 36, 0, 0)) }
    expect(framesSortedBy(many, 'quality')).toHaveLength(12)
  })

  it('does not reorder the original list', () => {
    framesSortedBy(person, 'gesture')
    expect(person.frames.map((f) => f.timestampSeconds)).toEqual([5, 10, 15])
  })
})
