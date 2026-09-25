import { elementsByCategory } from '../../data/elements'
import ElementPreview from './ElementPreview'

const FIT_HINTS = {
  behind: 'goes behind the headline',
  around: 'goes around the headline',
  under: 'goes under the headline',
  corner: 'sits at the headline’s corner',
  side: 'sits at the headline’s end',
  sideLeft: 'points at the headline',
}

/** The element library, by category. Picking one adds it, fitted to the headline where it can be. */
function ElementPickerModal({ onPick, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Add element"
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <h2 className="text-sm font-bold text-gray-100">Add element</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-sm" aria-label="Close">
            ✕
          </button>
        </div>
        <div className="overflow-y-auto p-4 flex flex-col gap-4">
          {elementsByCategory().map((category) => (
            <section key={category.id}>
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">{category.name}</h3>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {category.elements.map((element) => (
                  <button
                    key={element.id}
                    onClick={() => onPick(element.id)}
                    title={element.fit ? `${element.name}: ${FIT_HINTS[element.fit.mode]}` : element.name}
                    className="flex flex-col items-center gap-1 p-2 rounded-lg bg-gray-800/70 hover:bg-gray-700 border border-gray-700/60 hover:border-pink-500/60 transition-colors"
                  >
                    <div
                      className="w-full h-14 flex items-center justify-center rounded"
                      style={{ background: 'repeating-conic-gradient(#1f2937 0% 25%, #111827 0% 50%) 50% / 12px 12px' }}
                    >
                      <ElementPreview elementId={element.id} className="max-w-[90%] max-h-[90%]" />
                    </div>
                    <span className="text-[10px] text-gray-300 leading-tight text-center">{element.name}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}

export default ElementPickerModal
