import { parseErrorResponse, resolveBaseUrl } from './backend'

/** Texture presets the local engine offers; empty when the engine isn't reachable. */
export async function listTextures() {
  try {
    const response = await fetch(`${resolveBaseUrl()}/textures`)
    if (!response.ok) return { textures: [], available: false }
    return await response.json()
  } catch {
    return { textures: [], available: false }
  }
}

/** Renders a Core Image texture on the local engine; resolves to a JPEG data URL. */
export async function renderTexture({ preset, colors, seed, width, height }) {
  const response = await fetch(`${resolveBaseUrl()}/texture`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ preset, colors, seed, width, height }),
  })
  if (!response.ok) {
    throw new Error(await parseErrorResponse(response))
  }
  const data = await response.json()
  return data.image
}
