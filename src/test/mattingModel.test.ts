import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchMattingModel, startMattingDownload } from '../services/mattingModel'

// The sharper-edges model (BiRefNet, 973 MB) is downloaded once on request; the page
// asks the engine for its status and starts the download.
describe('matting model service', () => {
  afterEach(() => vi.unstubAllGlobals())

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

  it('reads the model status from the engine', async () => {
    const fetchMock = vi.fn(async (..._args: unknown[]) => json({ status: 'missing', progress: 0, sizeMb: 973 }))
    vi.stubGlobal('fetch', fetchMock)

    const state = await fetchMattingModel()

    expect(state).toMatchObject({ status: 'missing', sizeMb: 973 })
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/matting-model$/)
  })

  it('returns null when the engine is not running', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Load failed') }))

    expect(await fetchMattingModel()).toBeNull()
  })

  it('starts the download with a POST', async () => {
    const fetchMock = vi.fn(async (..._args: unknown[]) => json({ status: 'downloading', progress: 0 }, 202))
    vi.stubGlobal('fetch', fetchMock)

    const state = await startMattingDownload()

    expect(state.status).toBe('downloading')
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/matting-model\/download$/)
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST' })
  })
})
