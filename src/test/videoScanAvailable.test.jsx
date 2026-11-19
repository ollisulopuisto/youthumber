// REPRO: the video-scan buttons vanished when the speaker cards were memoised.
// window.pywebview is injected after the page's first render, so the one-shot
// isDesktopVideoScanAvailable() check stayed false until something re-rendered
// the panel. The availability must become reactive instead.
import { createRoot } from 'react-dom/client'
import { act, createElement as h } from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import SpeakerSlotsPanel from '../components/ThumbnailEditor/SpeakerSlotsPanel'
import { createDefaultProject } from '../modules/thumbnail/thumbnailState'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let container, root
afterEach(() => {
  if (root) {
    act(() => root.unmount())
    root = null
  }
  if (container) {
    container.remove()
    container = null
  }
  delete window.pywebview
})

function renderPanel() {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  const props = {
    project: createDefaultProject('Test'),
    onUploadSpeakerSource: () => {},
    onTriggerRemoveBackground: () => {},
    onAutoFrameSpeaker: () => {},
    onRemoveSpeaker: () => {},
    onRenameSpeaker: () => {},
    onMoveSpeaker: () => {},
    onUploadBackgroundImage: () => {},
    onClearBackgroundImage: () => {},
  }
  act(() => root.render(h(SpeakerSlotsPanel, props)))
}

function videoButtons() {
  return [...container.querySelectorAll('button')].filter((b) =>
    b.textContent.includes('from a video')
  )
}

function injectBridge() {
  window.pywebview = { api: { pick_video_file: () => null } }
  act(() => window.dispatchEvent(new Event('pywebviewready')))
}

describe('SpeakerSlotsPanel video scan availability', () => {
  it('shows the video buttons right away when the bridge is already there', () => {
    window.pywebview = { api: { pick_video_file: () => null } }
    renderPanel()
    expect(videoButtons().length).toBeGreaterThan(0)
  })

  it('hides them without the desktop bridge', () => {
    renderPanel()
    expect(videoButtons()).toHaveLength(0)
  })

  it('reveals them when the bridge arrives after the first render', () => {
    renderPanel()
    expect(videoButtons()).toHaveLength(0)
    injectBridge()
    expect(videoButtons().length).toBeGreaterThan(0)
  })
})

describe('useDesktopVideoScanAvailable startup ordering', () => {
  it('catches a bridge that arrived between the first render and the effect', async () => {
    // The bridge lands after the render-phase check but before effects subscribe,
    // and pywebviewready already fired, so no event is coming.
    const { createElement: h2 } = await import('react')
    const { useDesktopVideoScanAvailable } = await import('../services/videoScan')
    function Probe() {
      const available = useDesktopVideoScanAvailable()
      if (!window.pywebview) window.pywebview = { api: { pick_video_file: () => null } }
      return h2('span', null, String(available))
    }
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    act(() => root.render(h2(Probe)))
    expect(container.textContent).toBe('true')
  })
})
