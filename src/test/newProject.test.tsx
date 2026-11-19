// Devin on #116: New Project could lose the old project's last edits (the pending
// 600 ms autosave was cancelled by the switch) and a stale autosave could overwrite
// the flushed snapshot with older data. The flush must persist the live project
// before switching, refuse to switch when the save fails, and the autosave must
// always persist the latest state, never the state at schedule time.
import { createRoot } from 'react-dom/client'
import { act, createElement as h } from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { flushAndStartNewProject } from '../modules/thumbnail/newProject'
import { useAutosaveProject } from '../hooks/useAutosaveProject'
import type { ThumbnailProject } from '../types/thumbnail'

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

const project = (id: string, name: string) => ({ id, name }) as unknown as ThumbnailProject

describe('flushAndStartNewProject', () => {
  it('persists the live project before replacing it', async () => {
    const edited = project('p1', 'edited')
    const calls: string[] = []
    const save = vi.fn(async (p: ThumbnailProject) => {
      calls.push(`save:${p.id}:${p.name}`)
    })
    const setProject = vi.fn(() => calls.push('set'))
    const ok = await flushAndStartNewProject({
      getProject: () => edited,
      setProject,
      save,
      fresh: () => project('p2', 'fresh'),
    })
    expect(ok).toBe(true)
    expect(calls).toEqual(['save:p1:edited', 'set'])
    expect(setProject).toHaveBeenCalledWith(project('p2', 'fresh'))
  })

  it('persists edits that arrive while the flush is in flight', async () => {
    const box = { current: project('p1', 'v1') }
    const saved: string[] = []
    const setProject = vi.fn((p: ThumbnailProject) => {
      box.current = p
    })
    const save = vi.fn(async (p: ThumbnailProject) => {
      saved.push(p.name)
      // The user keeps editing while the first save is still writing.
      if (saved.length === 1) box.current = project('p1', 'v2')
    })
    const ok = await flushAndStartNewProject({
      getProject: () => box.current,
      setProject,
      save,
      fresh: () => project('p2', 'fresh'),
    })
    expect(ok).toBe(true)
    expect(saved).toEqual(['v1', 'v2'])
  })

  it('aborts the switch when another project became active during the flush', async () => {
    const box = { current: project('p1', 'v1') }
    const setProject = vi.fn((p: ThumbnailProject) => {
      box.current = p
    })
    const save = vi.fn(async () => {
      box.current = project('p9', 'elsewhere') // a gallery load landed mid-flush
    })
    const ok = await flushAndStartNewProject({
      getProject: () => box.current,
      setProject,
      save,
      fresh: () => project('p2', 'fresh'),
    })
    expect(ok).toBe(false)
    expect(setProject).not.toHaveBeenCalled()
    expect(box.current.id).toBe('p9')
  })

  it('lets only one of two overlapping flushes switch', async () => {
    const box = { current: project('p1', 'v1') }
    const setProject = vi.fn((p: ThumbnailProject) => {
      box.current = p
    })
    const args = {
      getProject: () => box.current,
      setProject,
      save: vi.fn(async () => {}),
      fresh: () => project(`p${Math.random()}`, 'fresh'),
    }
    const [a, b] = await Promise.all([flushAndStartNewProject(args), flushAndStartNewProject(args)])
    expect([a, b].filter(Boolean)).toHaveLength(1)
    expect(setProject).toHaveBeenCalledTimes(1)
  })

  it('keeps the old project open when the save fails', async () => {
    const setProject = vi.fn()
    const ok = await flushAndStartNewProject({
      getProject: () => project('p1', 'edited'),
      setProject,
      save: vi.fn(async () => {
        throw new Error('disk full')
      }),
      fresh: () => project('p2', 'fresh'),
    })
    expect(ok).toBe(false)
    expect(setProject).not.toHaveBeenCalled()
  })

  it('reports a failed save to the caller, so the user hears why nothing happened', async () => {
    const setProject = vi.fn()
    const onSaveError = vi.fn()
    const diskFull = new Error('disk full')
    const ok = await flushAndStartNewProject({
      getProject: () => project('p1', 'edited'),
      setProject,
      save: vi.fn(async () => {
        throw diskFull
      }),
      fresh: () => project('p2', 'fresh'),
      onSaveError,
    })
    expect(ok).toBe(false)
    expect(onSaveError).toHaveBeenCalledWith(diskFull)
  })

  it('does not cry save-error when another project simply became active mid-flush', async () => {
    const box = { current: project('p1', 'v1') }
    const onSaveError = vi.fn()
    const ok = await flushAndStartNewProject({
      getProject: () => box.current,
      setProject: vi.fn((p: ThumbnailProject) => {
        box.current = p
      }),
      save: vi.fn(async () => {
        box.current = project('p9', 'elsewhere')
      }),
      fresh: () => project('p2', 'fresh'),
      onSaveError,
    })
    expect(ok).toBe(false)
    expect(onSaveError).not.toHaveBeenCalled()
  })
})

describe('useAutosaveProject', () => {
  let container: HTMLDivElement, root: ReturnType<typeof createRoot>
  afterEach(() => {
    vi.useRealTimers()
    act(() => root.unmount())
    container.remove()
  })

  function renderWith(box: { current: ThumbnailProject }, save: (p: ThumbnailProject) => Promise<void>) {
    function Probe() {
      useAutosaveProject(box.current, () => box.current, save)
      return null
    }
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    act(() => root.render(h(Probe)))
  }

  it('persists the latest state, not the state at schedule time', async () => {
    vi.useFakeTimers()
    const box = { current: project('p1', 'v1') }
    const save = vi.fn(async () => {})
    renderWith(box, save)
    // An edit lands inside the 600 ms debounce window.
    box.current = project('p1', 'v2')
    act(() => {
      vi.advanceTimersByTime(700)
    })
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith(project('p1', 'v2'))
  })

  it('never lets a pending autosave overwrite the flushed snapshot with older data', async () => {
    vi.useFakeTimers()
    const box = { current: project('p1', 'v1') }
    const seen: string[] = []
    const save = vi.fn(async (p: ThumbnailProject) => {
      seen.push(p.name)
    })
    renderWith(box, save)
    // Edit within the debounce window, then New Project before it fires.
    box.current = project('p1', 'v2')
    const setProject = vi.fn((p: ThumbnailProject) => {
      box.current = p
    })
    await flushAndStartNewProject({
      getProject: () => box.current,
      setProject,
      save,
      fresh: () => project('p2', 'fresh'),
    })
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    // Every write carried the latest state; no stale 'v1' write landed after the flush.
    expect(seen).not.toContain('v1')
    expect(seen[0]).toBe('v2')
  })
})
