import { useEffect, useRef } from 'react'
import { SHORTCUTS, SHORTCUT_GROUPS, bindingKeys, isMacPlatform } from '../../modules/shortcuts/shortcuts'
import Kbd from './Kbd'

/** Every keyboard shortcut, grouped. Opens with ? or the toolbar's keyboard button; Esc closes. */
function ShortcutsModal({ onClose }) {
  const closeRef = useRef(null)
  const mac = isMacPlatform()

  useEffect(() => {
    // Hand focus back to whatever opened the sheet.
    const opener = document.activeElement
    closeRef.current?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'Tab') {
        // The close button is the only stop; keep focus in the dialog.
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
      aria-labelledby="shortcuts-title"
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <h2 id="shortcuts-title" className="text-sm font-bold text-gray-100">
            Keyboard shortcuts
          </h2>
          <button
            ref={closeRef}
            onClick={onClose}
            className="text-gray-400 hover:text-white text-sm rounded px-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto p-4 flex flex-col gap-4">
          {SHORTCUT_GROUPS.map((group) => (
            <section key={group}>
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">{group}</h3>
              <dl className="flex flex-col">
                {SHORTCUTS.filter((s) => s.group === group).map((shortcut) => (
                  <div
                    key={shortcut.id}
                    className="flex items-center justify-between gap-3 py-1.5 border-b border-gray-800/70 last:border-b-0"
                  >
                    <dt className="text-xs text-gray-300">{shortcut.label}</dt>
                    <dd className="flex items-center gap-1.5 shrink-0">
                      {shortcut.bindings.map((binding, i) => (
                        <span key={i} className="flex items-center gap-1">
                          {i > 0 && <span className="text-[10px] text-gray-500">or</span>}
                          {bindingKeys(binding, mac).map((key) => (
                            <Kbd key={key}>{key}</Kbd>
                          ))}
                        </span>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
        <p className="px-4 py-2.5 border-t border-gray-800 text-[11px] text-gray-500">
          Press <Kbd>?</Kbd> anywhere outside a text field to open this list.
        </p>
      </div>
    </div>
  )
}

export default ShortcutsModal
