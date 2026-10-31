import { useEffect, useRef } from 'react'

/** Changelog bullets lead with `**Lead.**` markdown bold; render it as bold. */
function ItemText({ text }) {
  const match = text.match(/^\*\*(.+?)\*\*\s*(.*)$/)
  if (!match) return text
  return (
    <>
      <strong className="text-gray-100">{match[1]}</strong> {match[2]}
    </>
  )
}

/** What's New: shipped changelog entries. Opens after an upgrade; always
 *  reachable from the toolbar. Esc or the Close button dismisses. */
function WhatsNewModal({ version, entries, onClose }) {
  const closeRef = useRef(null)

  useEffect(() => {
    const opener = document.activeElement
    closeRef.current?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'Tab') {
        e.preventDefault()
        closeRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (opener instanceof HTMLElement) opener.focus()
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="whatsnew-title"
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-4 pb-3 border-b border-gray-800">
          <h2 id="whatsnew-title" className="text-base font-semibold text-gray-100">
            What&apos;s new in YouThumber {version}
          </h2>
        </div>
        <div className="px-5 py-3 overflow-y-auto flex-1 min-h-0">
          {entries.map((entry) => (
            <section key={entry.version} className="mb-4 last:mb-0">
              <h3 className="text-sm font-semibold text-gray-200 mb-1.5">
                v{entry.version}
                {entry.date ? ` - ${entry.date}` : ''}
              </h3>
              <ul className="list-disc pl-5 space-y-1 text-sm text-gray-400">
                {entry.items.map((item) => (
                  <li key={item}>
                    <ItemText text={item} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-gray-800 flex justify-end">
          <button
            ref={closeRef}
            onClick={onClose}
            className="px-3 py-1.5 text-sm font-medium rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default WhatsNewModal
