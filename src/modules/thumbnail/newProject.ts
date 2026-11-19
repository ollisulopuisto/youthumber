import type { ThumbnailProject } from '../../types/thumbnail'

/**
 * New Project: persist the current project first, then switch. The debounced
 * autosave is cancelled by the switch, so without this flush the last few
 * hundred milliseconds of edits would never reach the gallery. A failed save
 * keeps the old project open instead of abandoning unsaved work. Returns
 * whether the switch happened. A failed save is also handed to `onSaveError`,
 * so the caller can tell the user why nothing visibly happened; a switch that
 * only lost the race to a gallery load is not an error and stays quiet.
 */
export async function flushAndStartNewProject({
  getProject,
  setProject,
  save,
  fresh,
  onSaveError,
}: {
  getProject: () => ThumbnailProject
  setProject: (project: ThumbnailProject) => void
  save: (project: ThumbnailProject) => Promise<unknown>
  fresh: () => ThumbnailProject
  onSaveError?: (error: unknown) => void
}): Promise<boolean> {
  // The editor stays live while a save is in flight. Edits are immutable
  // snapshots, so keep saving until the open project stops changing; bail out
  // when a different project became active (gallery load, a second ⌘N).
  const flushing = getProject()
  let snapshot = flushing
  for (;;) {
    try {
      await save(snapshot)
    } catch (err) {
      onSaveError?.(err)
      return false
    }
    const current = getProject()
    if (current.id !== flushing.id) return false
    if (current === snapshot) break
    snapshot = current
  }
  setProject(fresh())
  return true
}
