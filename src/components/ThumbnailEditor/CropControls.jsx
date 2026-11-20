import { setCropEdge } from '../../modules/thumbnail/imageCrop'

const EDGES = [
  ['left', 'Left'],
  ['top', 'Top'],
  ['right', 'Right'],
  ['bottom', 'Bottom'],
]

/** Four edge sliders (percent trimmed away) and a reset. `crop` is undefined when nothing is trimmed. */
function CropControls({ crop, onChange }) {
  return (
    <div className="flex flex-col gap-1.5" role="group" aria-label="Crop">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-gray-400">Crop</span>
        <button
          type="button"
          disabled={!crop}
          onClick={() => onChange(undefined)}
          className="text-[10px] px-2 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 disabled:opacity-40"
        >
          Reset crop
        </button>
      </div>
      {EDGES.map(([edge, label]) => {
        const percent = Math.round((crop?.[edge] ?? 0) * 100)
        return (
          <label key={edge} className="flex items-center gap-2 text-[10px] text-gray-400">
            <span className="w-12 shrink-0">{label}</span>
            <input
              type="range"
              min={0}
              max={90}
              step={1}
              value={percent}
              aria-label={`Crop ${label.toLowerCase()}`}
              onChange={(e) => onChange(setCropEdge(crop, edge, Number(e.target.value) / 100))}
              className="flex-1 accent-sky-500"
            />
            <span className="font-mono w-9 text-right text-gray-300">{percent}%</span>
          </label>
        )
      })}
    </div>
  )
}

export default CropControls
