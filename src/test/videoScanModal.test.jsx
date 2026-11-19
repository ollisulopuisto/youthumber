// Dropping a video on the window (or File > Import Video…) opens the scan modal
// with the path already chosen: the file is scanned in place, never copied or
// uploaded, and the native picker does not open a second time. Without a path
// the button keeps opening the picker.
import { createRoot } from 'react-dom/client'
import { act, createElement as h } from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import VideoScanModal from '../components/ThumbnailEditor/VideoScanModal'
import { pickVideoFile, scanVideoForSpeakers } from '../services/videoScan'
import { createDefaultProject } from '../modules/thumbnail/thumbnailState'

vi.mock('../services/videoScan', () => ({
  pickVideoFile: vi.fn(async () => '/picked/from-dialog.mp4'),
  // No faces found, so the modal stops at its error phase: these tests assert
  // which path was scanned, not the results view.
  scanVideoForSpeakers: vi.fn(async () => []),
  grabFullResolutionFrame: vi.fn(),
  framesSortedBy: (person) => person.frames,
}))

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
  vi.clearAllMocks()
})

function renderModal(props = {}) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  const project = createDefaultProject('Test')
  act(() =>
    root.render(
      h(VideoScanModal, {
        project,
        targetSpeakerId: null,
        scan: null,
        onScanComplete: () => {},
        onAssign: () => {},
        onClose: () => {},
        ...props,
      })
    )
  )
}

function scanButton() {
  return [...container.querySelectorAll('button')].find((b) =>
    /choose video|scan video/i.test(b.textContent)
  )
}

describe('VideoScanModal with a pre-chosen path', () => {
  it('names the dropped file instead of asking to choose one', () => {
    renderModal({ initialPath: '/Movies/talk.mp4' })
    expect(container.textContent).toContain('talk.mp4')
  })

  it('scans the dropped file in place without opening the picker', async () => {
    renderModal({ initialPath: '/Movies/talk.mp4' })
    await act(async () => scanButton().click())
    expect(pickVideoFile).not.toHaveBeenCalled()
    expect(scanVideoForSpeakers).toHaveBeenCalledWith('/Movies/talk.mp4', expect.anything())
  })

  it('still opens the picker when no path was dropped', async () => {
    renderModal()
    await act(async () => scanButton().click())
    expect(pickVideoFile).toHaveBeenCalled()
    expect(scanVideoForSpeakers).toHaveBeenCalledWith('/picked/from-dialog.mp4', expect.anything())
  })
})

// Devin on #123: a cached scan must not hide a newly dropped video, and "Scan
// another video" must let the user pick a different file instead of rescanning
// the dropped one.
describe('VideoScanModal scan-session interplay', () => {
  it('opens setup for a dropped video even when a previous scan is cached', () => {
    renderModal({
      initialPath: '/Movies/b.mp4',
      scan: { path: '/Movies/a.mp4', people: [{ frames: [] }] },
    })
    expect(container.textContent).toContain('b.mp4')
    expect(scanButton().textContent).toMatch(/scan video/i)
  })

  it('still reuses the cached scan when reopened without a new path', () => {
    renderModal({ scan: { path: '/Movies/a.mp4', people: [{ frames: [] }] } })
    expect([...container.querySelectorAll('button')].some((b) => b.textContent === 'Scan another video')).toBe(true)
  })

  it('"Scan another video" opens the picker instead of rescanning the dropped file', async () => {
    scanVideoForSpeakers.mockResolvedValueOnce([{ frames: [] }])
    let currentScan = null
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    const project = createDefaultProject('Test')
    const render = () =>
      root.render(
        h(VideoScanModal, {
          project,
          targetSpeakerId: null,
          initialPath: '/Movies/talk.mp4',
          scan: currentScan,
          onScanComplete: (s) => {
            currentScan = s
            act(render)
          },
          onAssign: () => {},
          onClose: () => {},
        })
      )
    act(render)
    await act(async () => scanButton().click())
    expect(container.textContent).not.toContain('Scan video')
    const another = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Scan another video')
    act(() => another.click())
    await act(async () => scanButton().click())
    expect(pickVideoFile).toHaveBeenCalled()
  })
})
