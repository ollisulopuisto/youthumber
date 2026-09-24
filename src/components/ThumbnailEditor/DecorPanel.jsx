import {
  DECOR_ELEMENTS,
  DECOR_POSITIONS,
  decorElement,
  randomDecor,
} from '../../modules/thumbnail/decor'
import { LOUD_COLORS, newSplashSeed } from '../../modules/thumbnail/textEffects'

/** Properties for the Graphics layer: which decorations are on, and each one's colour and place. */
function DecorPanel({ decor, onUpdateDecor }) {
  const current = decor ?? { visible: true, seed: 1, elements: {} }
  const setElement = (id, changes) => onUpdateDecor({ elements: { [id]: changes } })

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-3.5 flex flex-col gap-3 shadow-lg text-xs text-gray-200 overflow-y-auto max-h-[380px]">
      <div className="flex items-center justify-between border-b border-gray-800 pb-1.5">
        <h3 className="font-bold uppercase tracking-wider text-pink-400 text-[11px]">Graphics</h3>
        <div className="flex gap-1.5">
          <button
            onClick={() => onUpdateDecor({ seed: newSplashSeed() })}
            className="text-[10px] px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700"
            title="Same graphics, new random shapes"
          >
            Shuffle
          </button>
          <button
            onClick={() => onUpdateDecor(randomDecor(LOUD_COLORS))}
            className="text-[10px] px-2 py-1 rounded bg-pink-600 hover:bg-pink-500 text-white font-bold"
            title="A random loud combination"
          >
            Surprise me
          </button>
        </div>
      </div>

      <p className="text-[10px] text-gray-500 -mt-1">
        Drawn above the background. Move the Graphics layer up in Layers to put it in front of the speakers.
      </p>

      {DECOR_ELEMENTS.map((spec) => {
        const element = decorElement(current, spec.id)
        const settings = element ?? { ...spec.defaults, ...(current.elements?.[spec.id] ?? {}) }
        return (
          <div key={spec.id} className="flex flex-col gap-1.5 border-t border-gray-800 pt-2">
            <label className="flex items-center gap-2 text-[11px] font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={!!element}
                onChange={(e) => setElement(spec.id, { on: e.target.checked })}
                className="accent-pink-500"
              />
              {spec.label}
            </label>
            {element && (
              <div className="flex flex-col gap-1.5 pl-5">
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={settings.color}
                    onChange={(e) => setElement(spec.id, { color: e.target.value })}
                    aria-label={`${spec.label} colour`}
                    className="w-6 h-6 rounded border border-gray-700 cursor-pointer bg-transparent shrink-0"
                  />
                  <div className="flex flex-wrap gap-1">
                    {LOUD_COLORS.map((hex) => (
                      <button
                        key={hex}
                        onClick={() => setElement(spec.id, { color: hex })}
                        style={{ backgroundColor: hex }}
                        className="w-3.5 h-3.5 rounded-sm border border-gray-700 hover:scale-110 transition-transform"
                        aria-label={`${spec.label} colour: ${hex}`}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex rounded border border-gray-700 overflow-hidden text-[10px]" role="group" aria-label={`${spec.label} position`}>
                    {DECOR_POSITIONS.map((position) => (
                      <button
                        key={position.id}
                        onClick={() => setElement(spec.id, { position: position.id })}
                        aria-pressed={settings.position === position.id}
                        className={`px-2 py-0.5 ${
                          settings.position === position.id
                            ? 'bg-pink-600 text-white'
                            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        {position.label}
                      </button>
                    ))}
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={settings.opacity}
                    onChange={(e) => setElement(spec.id, { opacity: Number(e.target.value) })}
                    aria-label={`${spec.label} opacity`}
                    className="flex-1 accent-pink-500"
                  />
                  <span className="font-mono w-8 text-right text-[10px] text-gray-400">
                    {Math.round(settings.opacity * 100)}%
                  </span>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default DecorPanel
