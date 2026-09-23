import { describe, it, expect, vi, afterEach } from 'vitest'
import { framesSortedBy, scanVideoForSpeakers } from '../services/videoScan'

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

// The desktop window drops any request after 60 s, so a long scan's result never
// arrived (2026-09-23). The scan is a job: start it, then poll until it finishes.
describe('scanVideoForSpeakers', () => {
  afterEach(() => vi.unstubAllGlobals())

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

  it('starts a scan job, reports progress while polling, and returns the people', async () => {
    const people = [{ frameCount: 3, frames: [] }]
    const replies = [
      json({ jobId: 'j1' }, 202),
      json({ status: 'running', progress: 0.25 }),
      json({ status: 'running', progress: 0.8 }),
      json({ status: 'done', progress: 1, people }),
    ]
    const fetchMock = vi.fn(async (..._args: unknown[]) => replies.shift()!)
    vi.stubGlobal('fetch', fetchMock)
    const seen: number[] = []

    const result = await scanVideoForSpeakers('/v.mp4', {
      numPeople: 2,
      onProgress: (p: number) => seen.push(p),
      pollMs: 0,
    })

    expect(result).toEqual(people)
    expect(seen).toEqual([0.25, 0.8, 1])
    expect(fetchMock.mock.calls[1][0]).toMatch(/\/scan-video-speakers\/j1$/)
  })

  it('throws the scan’s error when the job fails', async () => {
    const replies = [json({ jobId: 'j2' }, 202), json({ status: 'error', progress: 0.1, error: 'Video scan failed: bad file' })]
    vi.stubGlobal('fetch', vi.fn(async () => replies.shift()!))

    await expect(scanVideoForSpeakers('/v.mp4', { pollMs: 0 })).rejects.toThrow('Video scan failed: bad file')
  })
})
