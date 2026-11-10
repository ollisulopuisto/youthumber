// Optional rendered regression: npm install --no-save --package-lock=false playwright
// Then node tests/manual/editor-workspace.mjs (install Chromium with npx playwright install chromium).
import assert from 'node:assert/strict'
import process from 'node:process'
import { Buffer } from 'node:buffer'
import { createServer } from 'vite'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const server = await createServer({ server: { host: '127.0.0.1', port: 4198 } })
await server.listen()
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})
try {
  const page = await browser.newPage()
  await page.addInitScript(() => localStorage.setItem('whats-new-seen', '99.12.31.1'))
  await page.route('**/health', route => route.fulfill({ json: { status: 'ok', removers: [] } }))
  for (const height of [600, 800, 900]) {
    await page.setViewportSize({ width: 1280, height })
    await page.goto('http://127.0.0.1:4198')
    await page.getByRole('button', { name: '4', exact: true }).click()
    const properties = page.locator('[aria-label="Properties"]')
    await properties.waitFor()
    const inputs = page.locator('input[type="file"][accept="image/jpeg,image/png,image/webp"]')
    // Four tiny real PNG uploads take the taller populated-card path.
    for (let i = 0; i < 4; i++) {
      await inputs.nth(i).setInputFiles({ name: 'speaker.png', mimeType: 'image/png',
        buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2s8AAAAASUVORK5CYII=', 'base64') })
    }
    await page.getByAltText('Original', { exact: true }).last().waitFor()
    await page.getByRole('option').filter({ hasText: 'Headline' }).click()
    await page.getByText('Text Properties', { exact: true }).waitFor()
    const bounds = await properties.evaluate(el => {
      const side = el.parentElement, work = side.parentElement
      const speakers = work.lastElementChild, canvas = work.firstElementChild
      side.scrollTop = side.scrollHeight
      speakers.scrollTop = speakers.scrollHeight
      return { canvasHeight: canvas.clientHeight, sidebarBottom: side.getBoundingClientRect().bottom,
        speakerBottom: speakers.getBoundingClientRect().bottom, viewport: innerHeight,
        speakerOverflow: getComputedStyle(speakers).overflowY,
        propertiesBottom: el.getBoundingClientRect().bottom,
        lastSpeakerControlBottom: speakers.firstElementChild.getBoundingClientRect().bottom }
    })
    assert(bounds.canvasHeight >= 200, JSON.stringify(bounds))
    assert.equal(bounds.sidebarBottom, height)
    assert.equal(bounds.speakerBottom, height)
    assert.equal(bounds.speakerOverflow, 'auto')
    assert(bounds.propertiesBottom <= height)
    assert(bounds.lastSpeakerControlBottom <= height + 1)
    console.log(height, bounds)
    if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/youthumber-four-${height}.png` })
  }
} finally {
  await browser.close()
  await server.close()
}
