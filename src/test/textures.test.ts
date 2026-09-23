import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderTexture, listTextures } from '../services/textures'

afterEach(() => vi.restoreAllMocks())

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('texture service', () => {
  it('asks the local engine for a texture and returns the image', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse({ image: 'data:image/jpeg;base64,AAA' }))

    const image = await renderTexture({
      preset: 'smoke',
      colors: ['#000000', '#ffffff'],
      seed: 4,
      width: 320,
      height: 180,
    })

    expect(image).toBe('data:image/jpeg;base64,AAA')
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toMatch(/\/texture$/)
    expect(JSON.parse(String(init?.body))).toEqual({
      preset: 'smoke',
      colors: ['#000000', '#ffffff'],
      seed: 4,
      width: 320,
      height: 180,
    })
  })

  it('reports the engine’s error message when a texture fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ detail: 'Unknown texture preset' }, 400))

    await expect(
      renderTexture({ preset: 'nope', colors: ['#000000', '#ffffff'], seed: 1, width: 16, height: 9 })
    ).rejects.toThrow('Unknown texture preset')
  })

  it('lists presets, or none when the engine is unreachable', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse({ textures: [{ id: 'grain', name: 'Film grain' }], available: true })
    )
    expect(await listTextures()).toEqual({ textures: [{ id: 'grain', name: 'Film grain' }], available: true })

    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'))
    expect(await listTextures()).toEqual({ textures: [], available: false })
  })
})
