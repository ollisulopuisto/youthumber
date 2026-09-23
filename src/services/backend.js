/**
 * Where the local YouThumber engine (the Python backend) is, and how to read its errors.
 * In the desktop app the page is served by the engine itself; with the Vite dev server
 * on :5173 the engine runs separately on :5055.
 */
export function resolveBaseUrl() {
  if (
    typeof window !== 'undefined' &&
    window.location?.origin?.startsWith('http') &&
    !window.location.origin.includes(':5173')
  ) {
    return window.location.origin.replace(/\/+$/, '')
  }
  return 'http://127.0.0.1:5055'
}

export async function parseErrorResponse(response) {
  const text = await response.text().catch(() => response.statusText)
  try {
    const json = JSON.parse(text)
    return json.detail || text
  } catch {
    return text
  }
}
