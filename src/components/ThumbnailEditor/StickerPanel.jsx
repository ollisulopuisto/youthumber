import { findElement } from '../../data/elements'
import { LOUD_COLORS } from '../../modules/thumbnail/textEffects'
import ElementPreview from './ElementPreview'

function ColorRow({ label, value, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 text-[10px] text-gray-400 shrink-0">{label}</span>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`${label} colour`}
        className="w-6 h-6 rounded border border-gray-700 cursor-pointer bg-transparent shrink-0"
      />
      <div className="flex flex-wrap gap-1">
        {[...LOUD_COLORS, '#111111'].map((hex) => (
          <button
            key={hex}
            onClick={() => onChange(hex)}
            style={{ backgroundColor: hex }}
            className="w-3.5 h-3.5 rounded-sm border border-gray-700 hover:scale-110 transition-transform"
            aria-label={`${label} colour: ${hex}`}
          />
        ))}
      </div>
    </div>
  )
}

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
        className="flex-1 accent-pink-500"
      />
      <span className="font-mono w-10 text-right text-gray-300">{format(value)}</span>
    </label>
  )
}

const BUTTON = 'text-[10px] px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700'

/** Properties of one placed element: colours, text, line weight, sticker border, shadow, placement. */
function StickerPanel({ project, sticker, onUpdate, onRemove, onDuplicate, onFit, onBehindText }) {
  const spec = findElement(sticker.elementId)
  if (!spec) return null
  const hasLabel = spec.parts.some((p) => p.label)
  const hasStrokes = spec.parts.some((p) => p.stroke && p.width)
  const order = project.layerOrder
  const isBehindText = order.indexOf(sticker.id) < order.indexOf('text')
  const update = (changes) => onUpdate(sticker.id, changes)

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-3.5 flex flex-col gap-2.5 shadow-lg text-xs text-gray-200 overflow-y-auto max-h-[380px]">
      <div className="flex items-center justify-between border-b border-gray-800 pb-1.5 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 shrink-0">
            <ElementPreview elementId={spec.id} colors={sticker.colors} text={sticker.text} />
          </div>
          <h3 className="font-bold uppercase tracking-wider text-pink-400 text-[11px] truncate">{spec.name}</h3>
        </div>
        <div className="flex gap-1 shrink-0">
          <button onClick={() => onDuplicate(sticker.id)} className={BUTTON}>
            Duplicate
          </button>
          <button
            onClick={() => onRemove(sticker.id)}
            className="text-[10px] px-2 py-1 rounded bg-red-900/60 hover:bg-red-800 text-red-100 border border-red-800"
          >
            Delete
          </button>
        </div>
      </div>

      {/* How it sits with the headline */}
      <div className="flex flex-wrap gap-1.5">
        {spec.fit && (
          <button onClick={() => onFit(sticker.id)} className="text-[10px] px-2 py-1 rounded bg-pink-600 hover:bg-pink-500 text-white font-bold">
            Fit to headline
          </button>
        )}
        <div className="flex rounded border border-gray-700 overflow-hidden text-[10px]" role="group" aria-label="Order">
          {[
            { behind: true, label: 'Behind text' },
            { behind: false, label: 'In front' },
          ].map((option) => (
            <button
              key={option.label}
              onClick={() => onBehindText(sticker.id, option.behind)}
              aria-pressed={isBehindText === option.behind}
              className={`px-2 py-1 ${
                isBehindText === option.behind ? 'bg-pink-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <button onClick={() => update({ flipX: !sticker.flipX })} className={BUTTON}>
          ↔ Flip
        </button>
      </div>

      {hasLabel && (
        <label className="flex items-center gap-2 text-[10px] text-gray-400">
          <span className="w-14 shrink-0">Text</span>
          <input
            type="text"
            value={sticker.text ?? spec.text ?? ''}
            onChange={(e) => update({ text: e.target.value })}
            className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-pink-500"
          />
        </label>
      )}

      <ColorRow label="Colour" value={sticker.colors.primary} onChange={(primary) => update({ colors: { primary } })} />
      <ColorRow label="Accent" value={sticker.colors.accent} onChange={(accent) => update({ colors: { accent } })} />

      {hasStrokes && (
        <Slider
          label="Line"
          value={sticker.lineWeight}
          min={0.3}
          max={3}
          step={0.1}
          format={(v) => `${v.toFixed(1)}×`}
          onChange={(lineWeight) => update({ lineWeight })}
        />
      )}
      <Slider
        label="Opacity"
        value={sticker.opacity}
        min={0.1}
        max={1}
        step={0.05}
        format={(v) => `${Math.round(v * 100)}%`}
        onChange={(opacity) => update({ opacity })}
      />

      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Slider
            label="Border"
            value={sticker.outline}
            min={0}
            max={16}
            step={1}
            format={(v) => `${v}px`}
            onChange={(outline) => update({ outline })}
          />
        </div>
        <input
          type="color"
          value={sticker.outlineColor}
          onChange={(e) => update({ outlineColor: e.target.value })}
          aria-label="Border colour"
          className="w-6 h-6 rounded border border-gray-700 cursor-pointer bg-transparent shrink-0"
        />
      </div>

      <label className="flex items-center gap-2 text-[11px] text-gray-300 cursor-pointer">
        <input
          type="checkbox"
          checked={sticker.shadow}
          onChange={(e) => update({ shadow: e.target.checked })}
          className="accent-pink-500"
        />
        Drop shadow
      </label>
    </div>
  )
}

export default StickerPanel
