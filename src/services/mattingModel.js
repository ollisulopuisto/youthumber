/**
 * The engine's sharper-edges model (BiRefNet, ~1 GB): downloaded once when the user
 * asks, then used for every background removal. Status: missing | downloading | ready | error.
 */
import { parseErrorResponse, resolveBaseUrl } from './backend'

/** The model's status, or null when the engine isn't running (e.g. the web build). */
export async function fetchMattingModel() {
  try {
    const response = await fetch(`${resolveBaseUrl()}/matting-model`)
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

export async function startMattingDownload() {
  const response = await fetch(`${resolveBaseUrl()}/matting-model/download`, { method: 'POST' })
  if (!response.ok) {
    throw new Error(`Model download failed: ${await parseErrorResponse(response)}`)
  }
  return response.json()
}
