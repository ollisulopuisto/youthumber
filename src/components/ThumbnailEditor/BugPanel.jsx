const BUTTON = 'text-[10px] px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700'

function Slider({ label, value, min, max, step, format, onChange }) {
  return (
    <label className="flex items-center gap-2 text-[10px] text-gray-400">
      <span className="w-14 shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-violet-500"
      />
      <span className="font-mono w-10 text-right text-gray-300">{format(value)}</span>
    </label>
  )
}

/** Properties of one bug (logo): size, opacity, flip, shadow. */
function BugPanel({ bug, onUpdate, onRemove, onDuplicate }) {
  const update = (changes) => onUpdate(bug.id, changes)
  const aspect = bug.width / (bug.height || 1)

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-3.5 flex flex-col gap-2.5 shadow-lg text-xs text-gray-200 overflow-y-auto max-h-[380px]">
      <div className="flex items-center justify-between border-b border-gray-800 pb-1.5 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <img src={bug.imageUrl} alt="" className="w-8 h-8 object-contain shrink-0 rounded bg-gray-800" />
          <h3 className="font-bold uppercase tracking-wider text-violet-400 text-[11px] truncate">{bug.name}</h3>
        </div>
        <div className="flex gap-1 shrink-0">
          <button onClick={() => onDuplicate(bug.id)} className={BUTTON}>
            Duplicate
          </button>
          <button
            onClick={() => onRemove(bug.id)}
            className="text-[10px] px-2 py-1 rounded bg-red-900/60 hover:bg-red-800 text-red-100 border border-red-800"
          >
            Delete
          </button>
        </div>
      </div>

      <Slider
        label="Size"
        value={bug.width}
        min={30}
        max={600}
        step={5}
        format={(v) => `${v}px`}
        onChange={(width) => update({ width, height: Math.round(width / aspect) })}
      />
      <Slider
        label="Opacity"
        value={bug.opacity}
        min={0.1}
        max={1}
        step={0.05}
        format={(v) => `${Math.round(v * 100)}%`}
        onChange={(opacity) => update({ opacity })}
      />
      <Slider
        label="Rotate"
        value={bug.rotation}
        min={-180}
        max={180}
        step={1}
        format={(v) => `${v}°`}
        onChange={(rotation) => update({ rotation })}
      />

      <div className="flex items-center gap-3">
        <button onClick={() => update({ flipX: !bug.flipX })} className={BUTTON}>
          ↔ Flip
        </button>
        <label className="flex items-center gap-2 text-[11px] text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={bug.shadow}
            onChange={(e) => update({ shadow: e.target.checked })}
            className="accent-violet-500"
          />
          Drop shadow
        </label>
      </div>
    </div>
  )
}

export default BugPanel
