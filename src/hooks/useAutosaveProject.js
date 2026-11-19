import { useEffect } from 'react'
import { saveProjectToStorage } from '../modules/thumbnail/thumbnailStorage'

/**
 * Idle autosave for the open project, debounced 600 ms after the last change.
 * Saves getProject() when the timer fires, never the render-time snapshot: a
 * pending save can fire after newer edits landed, and it must persist those.
 * That is what keeps a flush-then-switch (New Project) from being overwritten
 * by an older scheduled write.
 */
export function useAutosaveProject(project, getProject, save = saveProjectToStorage) {
  useEffect(() => {
    // Serialising a project full of data-URL images is heavy; do it when the browser is idle.
    let idle
    const timer = setTimeout(() => {
      const saveNow = () => save(getProject()).catch((err) => console.warn('Autosave failed:', err))
      if (window.requestIdleCallback) idle = window.requestIdleCallback(saveNow, { timeout: 2000 })
      else saveNow()
    }, 600)
    return () => {
      clearTimeout(timer)
      if (idle) window.cancelIdleCallback(idle)
    }
  }, [project, getProject, save])
}
