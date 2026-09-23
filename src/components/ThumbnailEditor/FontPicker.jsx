import { closestWeight, findStudioFont, fontsByCategory } from '../../data/studioFonts'

const WEIGHT_BUTTONS = [
  { weight: 400, label: 'Regular' },
  { weight: 700, label: 'Bold' },
  { weight: 900, label: 'Black' },
]

/** Headline font list, each name shown in its own font, plus the weights that font has. */
function FontPicker({ fontFamily, fontWeight, onChange }) {
  const current = findStudioFont(fontFamily)
  const currentWeight = current ? closestWeight(current, fontWeight) : 700

  const pickFont = (font) =>
    // Keep the weight if the new font has it; otherwise its nearest real one, so the
    // browser never has to fake a bold that isn't loaded.
    onChange({ fontFamily: font.family, fontWeight: String(closestWeight(font, fontWeight)) })

  return (
    <div className="flex flex-col gap-2">
      <div
        className="max-h-44 overflow-y-auto rounded border border-gray-700 bg-gray-950/60"
        role="listbox"
        aria-label="Font"
      >
        {fontsByCategory().map((group) => (
          <div key={group.category}>
            <div className="sticky top-0 bg-gray-900 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-gray-500">
              {group.category}
            </div>
            {group.fonts.map((font) => {
              const selected = font.family === fontFamily
              return (
                <button
                  key={font.family}
                  role="option"
                  aria-selected={selected}
                  onClick={() => pickFont(font)}
                  className={`w-full text-left px-2 py-1 text-sm truncate transition-colors ${
                    selected ? 'bg-amber-500/20 text-amber-200' : 'text-gray-200 hover:bg-gray-800'
                  }`}
                  style={{
                    fontFamily: `"${font.family}"`,
                    fontWeight: closestWeight(font, fontWeight),
                  }}
                >
                  {font.family}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-1" role="group" aria-label="Font weight">
        {WEIGHT_BUTTONS.map(({ weight, label }) => {
          const available = !current || current.weights.includes(weight)
          return (
            <button
              key={weight}
              onClick={() => onChange({ fontWeight: String(weight) })}
              disabled={!available}
              aria-pressed={currentWeight === weight}
              title={available ? undefined : `${fontFamily} has no ${label.toLowerCase()} weight`}
              className={`py-1 rounded text-[11px] transition-colors disabled:opacity-30 ${
                currentWeight === weight
                  ? 'bg-amber-500 text-gray-950 font-bold'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
              style={{ fontWeight: weight }}
            >
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default FontPicker
