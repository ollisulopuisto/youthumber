/** Fabric 7 returns target info, not a bare object. Preserve an active hit. */
export function preferActiveTarget(canvas, event, fallback) {
  const result = fallback(event)
  const active = canvas.getActiveObject()
  if (!active) return result
  const hit = canvas.searchPossibleTargets([active], canvas.getScenePoint(event))
  const control = active.findControl(canvas.getViewportPoint(event))
  return control || hit.target ? { ...result, ...hit, target: active } : result
}
