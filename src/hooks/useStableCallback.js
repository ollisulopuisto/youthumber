import { useCallback, useLayoutEffect, useRef } from 'react'

/**
 * A callback whose identity never changes but always runs the latest `fn`, so memoised
 * children don't re-render just because the parent recreated a handler.
 */
export function useStableCallback(fn) {
  const latest = useRef(fn)
  useLayoutEffect(() => {
    latest.current = fn
  })
  return useCallback((...args) => latest.current(...args), [])
}
