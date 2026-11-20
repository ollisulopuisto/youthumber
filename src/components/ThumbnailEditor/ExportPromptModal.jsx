import { useEffect, useRef } from 'react'

/**
 * Two questions the export can ask. 'exists': the file is already there; Replace, Keep both
 * or Cancel (Cancel has focus, so Enter never overwrites). 'error': why nothing was saved.
 * `onChoose('replace' | 'keep' | 'cancel')`; an error only has 'cancel' (OK).
 */
function ExportPromptModal({ kind, path, message, onChoose }) {
  const safeRef = useRef(null)

  useEffect(() => {
    const opener = document.activeElement
    safeRef.current?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onChoose('cancel')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (opener instanceof HTMLElement) opener.focus()
    }
  }, [onChoose])

  const name = path ? path.split(/[\\/]/).pop() : ''
  const button =
    'px-3 py-1.5 rounded text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500'

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="export-prompt-title"
      aria-describedby="export-prompt-body"
    >
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md p-5">
        <h2 id="export-prompt-title" className="text-base font-semibold text-gray-100">
          {kind === 'exists' ? `"${name}" already exists` : 'Export failed'}
        </h2>
        <p id="export-prompt-body" className="mt-2 text-sm text-gray-300 break-words select-text">
          {kind === 'exists'
            ? 'Replace it with this thumbnail, or save this one next to it as a numbered copy?'
            : message}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          {kind === 'exists' ? (
            <>
              <button ref={safeRef} className={`${button} bg-gray-800 text-gray-100 hover:bg-gray-700`} onClick={() => onChoose('cancel')}>
                Cancel
              </button>
              <button className={`${button} bg-gray-800 text-gray-100 hover:bg-gray-700`} onClick={() => onChoose('keep')}>
                Keep both
              </button>
              <button className={`${button} bg-red-700 text-white hover:bg-red-600`} onClick={() => onChoose('replace')}>
                Replace
              </button>
            </>
          ) : (
            <button ref={safeRef} className={`${button} bg-amber-600 text-black hover:bg-amber-500`} onClick={() => onChoose('cancel')}>
              OK
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default ExportPromptModal
