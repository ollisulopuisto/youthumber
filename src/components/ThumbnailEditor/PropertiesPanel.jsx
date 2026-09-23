import { backgroundGradientPresets } from '../../data/backgroundGradients'
import { speakerLabel } from '../../modules/thumbnail/thumbnailState'
import { cssGradient } from '../../modules/thumbnail/backgroundRender'
import FontPicker from './FontPicker'

// "Blurred speaker photo" background: enough blur to read as a soft studio backdrop,
// darkened so the cutouts and headline stand out. Starting points; both are sliders.
const STUDIO_BLUR_PX = 16
const STUDIO_DARKEN = 0.35

function PropertiesPanel({
  selectedLayer,
  project,
  onUpdateText,
  onUpdateSpeakerTransform,
  onUpdateBackground,
  onResetSpeakerTransform,
  onUpdateSpeakerMaskOptions,
}) {
  if (!selectedLayer) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col items-center justify-center text-center text-gray-500 text-xs h-full shadow-lg">
        <span className="text-2xl mb-1.5 opacity-60">🎯</span>
        <p className="font-medium text-gray-400">No object selected</p>
        <p className="text-[11px] mt-1 text-gray-500">
          Click an element on the canvas or in the Layers list to adjust its properties.
        </p>
      </div>
    )
  }

  // 1. Text Properties
  if (selectedLayer === 'text') {
    const textState = project.text
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-3.5 flex flex-col gap-3 shadow-lg text-xs text-gray-200 overflow-y-auto max-h-[380px]">
        <div className="flex items-center justify-between border-b border-gray-800 pb-1.5">
          <h3 className="font-bold uppercase tracking-wider text-amber-400 text-[11px]">
            Text Properties
          </h3>
          <span className="text-[10px] text-gray-500 font-mono">Headline</span>
        </div>

        {/* Text Input */}
        <div>
          <label className="block text-[11px] font-medium text-gray-400 mb-1">Headline Content</label>
          <textarea
            rows={2}
            value={textState.text}
            onChange={(e) => onUpdateText({ text: e.target.value })}
            className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-white font-medium outline-none focus:border-amber-500 resize-none text-xs"
          />
        </div>

        {/* Font */}
        <div>
          <label className="block text-[10px] font-medium text-gray-400 mb-1">Font</label>
          <FontPicker
            fontFamily={textState.fontFamily}
            fontWeight={textState.fontWeight}
            onChange={onUpdateText}
          />
        </div>

        {/* Size */}
        <div>
          <div>
            <label className="block text-[10px] font-medium text-gray-400 mb-1">
              Size ({textState.fontSize}px)
            </label>
            <input
              type="range"
              min={24}
              max={120}
              value={textState.fontSize}
              onChange={(e) => onUpdateText({ fontSize: Number(e.target.value) })}
              className="w-full accent-amber-500"
            />
          </div>
        </div>

        {/* Text Alignment */}
        <div>
          <label className="block text-[10px] font-medium text-gray-400 mb-1">Alignment</label>
          <div className="grid grid-cols-3 gap-1">
            {['left', 'center', 'right'].map((align) => (
              <button
                key={align}
                onClick={() => onUpdateText({ textAlign: align })}
                className={`py-1 rounded text-center font-medium capitalize transition-colors ${
                  textState.textAlign === align
                    ? 'bg-amber-500 text-gray-950 font-bold'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {align}
              </button>
            ))}
          </div>
        </div>

        {/* Fill Color & Stroke */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-medium text-gray-400 mb-1">Fill Color</label>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={textState.fillColor}
                onChange={(e) => onUpdateText({ fillColor: e.target.value })}
                className="w-7 h-7 rounded border border-gray-700 cursor-pointer bg-transparent"
              />
              <span className="font-mono text-[11px] text-gray-300">{textState.fillColor}</span>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-medium text-gray-400 mb-1">
              Outline ({textState.strokeWidth || 0}px)
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                value={textState.strokeColor || '#000000'}
                onChange={(e) => onUpdateText({ strokeColor: e.target.value })}
                className="w-7 h-7 rounded border border-gray-700 cursor-pointer bg-transparent"
              />
              <input
                type="range"
                min={0}
                max={15}
                value={textState.strokeWidth || 0}
                onChange={(e) => onUpdateText({ strokeWidth: Number(e.target.value) })}
                className="w-full accent-amber-500"
              />
            </div>
          </div>
        </div>

        {/* Shadow */}
        <div>
          <label className="block text-[10px] font-medium text-gray-400 mb-1">
            Shadow Blur ({textState.shadowBlur || 0}px)
          </label>
          <input
            type="range"
            min={0}
            max={30}
            value={textState.shadowBlur || 0}
            onChange={(e) => onUpdateText({ shadowBlur: Number(e.target.value) })}
            className="w-full accent-amber-500"
          />
        </div>
      </div>
    )
  }

  // 2. Speaker Properties
  const speaker = project.speakers.find((s) => s.id === selectedLayer)
  if (speaker) {
    const transform = speaker.transform

    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-3.5 flex flex-col gap-3 shadow-lg text-xs text-gray-200 overflow-y-auto max-h-[380px]">
        <div className="flex items-center justify-between border-b border-gray-800 pb-1.5">
          <h3 className="font-bold uppercase tracking-wider text-sky-400 text-[11px]">
            {speakerLabel(project, speaker.id)}
          </h3>
          <button
            onClick={() => onResetSpeakerTransform(selectedLayer)}
            className="text-[10px] text-gray-400 hover:text-white underline"
          >
            Reset Position
          </button>
        </div>

        {/* Scale Slider */}
        <div>
          <div className="flex justify-between text-[11px] mb-1">
            <span className="text-gray-400">Scale</span>
            <span className="font-mono text-gray-200">{transform.scaleX.toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min={0.2}
            max={2.5}
            step={0.05}
            value={transform.scaleX}
            onChange={(e) => {
              const val = Number(e.target.value)
              onUpdateSpeakerTransform(selectedLayer, { scaleX: val, scaleY: val })
            }}
            className="w-full accent-sky-500"
          />
        </div>

        {/* Rotation Slider */}
        <div>
          <div className="flex justify-between text-[11px] mb-1">
            <span className="text-gray-400">Rotation</span>
            <span className="font-mono text-gray-200">{transform.rotation}°</span>
          </div>
          <input
            type="range"
            min={-45}
            max={45}
            step={1}
            value={transform.rotation}
            onChange={(e) =>
              onUpdateSpeakerTransform(selectedLayer, { rotation: Number(e.target.value) })
            }
            className="w-full accent-sky-500"
          />
        </div>

        {/* Coordinates X, Y */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-medium text-gray-400 mb-1">Position X (px)</label>
            <input
              type="number"
              value={transform.x}
              onChange={(e) =>
                onUpdateSpeakerTransform(selectedLayer, { x: Number(e.target.value) })
              }
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white font-mono outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-medium text-gray-400 mb-1">Position Y (px)</label>
            <input
              type="number"
              value={transform.y}
              onChange={(e) =>
                onUpdateSpeakerTransform(selectedLayer, { y: Number(e.target.value) })
              }
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white font-mono outline-none focus:border-sky-500"
            />
          </div>
        </div>

        {/* Flip Horizontal */}
        <div>
          <button
            onClick={() =>
              onUpdateSpeakerTransform(selectedLayer, { flipX: !transform.flipX })
            }
            className={`w-full py-1.5 rounded font-medium border text-xs transition-colors flex items-center justify-center gap-1.5 ${
              transform.flipX
                ? 'bg-sky-500/20 border-sky-500 text-sky-300'
                : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
            }`}
          >
            <span>↔ Flip Horizontal</span>
          </button>
        </div>

        {/* Mask Refinement Controls */}
        {(speaker.maskUrl || speaker.cutoutUrl) && (
          <div className="border-t border-gray-800 pt-2.5 mt-1 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sky-400 text-[11px] uppercase tracking-wider">
                Mask Refinement
              </h4>
              <button
                onClick={() =>
                  onUpdateSpeakerMaskOptions?.(selectedLayer, {
                    feather: 0,
                    threshold: 0,
                    opacity: 1,
                    invert: false,
                  })
                }
                className="text-[10px] text-gray-400 hover:text-white underline"
              >
                Reset Mask
              </button>
            </div>

            {/* Feather slider */}
            <div>
              <div className="flex justify-between text-[11px] mb-0.5">
                <span className="text-gray-400">Edge Feather</span>
                <span className="font-mono text-gray-200">
                  {speaker.maskOptions?.feather ?? 0}px
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={20}
                step={1}
                value={speaker.maskOptions?.feather ?? 0}
                onChange={(e) =>
                  onUpdateSpeakerMaskOptions?.(selectedLayer, {
                    feather: Number(e.target.value),
                  })
                }
                className="w-full accent-sky-500"
              />
            </div>

            {/* Edge Choke / Threshold slider */}
            <div>
              <div className="flex justify-between text-[11px] mb-0.5">
                <span className="text-gray-400">Edge Choke / Threshold</span>
                <span className="font-mono text-gray-200">
                  {speaker.maskOptions?.threshold ?? 0}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={255}
                step={5}
                value={speaker.maskOptions?.threshold ?? 0}
                onChange={(e) =>
                  onUpdateSpeakerMaskOptions?.(selectedLayer, {
                    threshold: Number(e.target.value),
                  })
                }
                className="w-full accent-sky-500"
              />
            </div>

            {/* Opacity slider */}
            <div>
              <div className="flex justify-between text-[11px] mb-0.5">
                <span className="text-gray-400">Speaker Opacity</span>
                <span className="font-mono text-gray-200">
                  {Math.round((speaker.maskOptions?.opacity ?? 1) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0.05}
                max={1}
                step={0.05}
                value={speaker.maskOptions?.opacity ?? 1}
                onChange={(e) =>
                  onUpdateSpeakerMaskOptions?.(selectedLayer, {
                    opacity: Number(e.target.value),
                  })
                }
                className="w-full accent-sky-500"
              />
            </div>
          </div>
        )}
      </div>
    )
  }

  // 3. Background Properties
  if (selectedLayer === 'background') {
    const bg = project.background
    // The custom gradient edits the current gradient, or starts from the first preset.
    const base = bg.gradient ?? backgroundGradientPresets[0]
    const customGradient = {
      colors: [base.colors[0], base.colors[base.colors.length - 1]],
      angle: base.angle ?? 135,
      type: base.type ?? 'linear',
    }
    const setGradient = (changes) =>
      onUpdateBackground({ type: 'gradient', gradient: { ...customGradient, ...changes } })
    const speakersWithPhotos = project.speakers.filter((s) => s.sourceImageUrl)

    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-3.5 flex flex-col gap-3 shadow-lg text-xs text-gray-200 overflow-y-auto max-h-[380px]">
        <div className="flex items-center justify-between border-b border-gray-800 pb-1.5">
          <h3 className="font-bold uppercase tracking-wider text-emerald-400 text-[11px]">
            Background Properties
          </h3>
          <span className="text-[10px] text-gray-500 font-mono">1280 × 720</span>
        </div>

        {/* Solid Color Picker */}
        <div>
          <label className="block text-[10px] font-medium text-gray-400 mb-1.5">Solid Color</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={bg.color || '#111827'}
              onChange={(e) => onUpdateBackground({ color: e.target.value, type: 'solid' })}
              className="w-8 h-8 rounded border border-gray-700 cursor-pointer bg-transparent"
            />
            <span className="font-mono text-xs text-gray-300">{bg.color}</span>
          </div>

          {/* Quick Color Presets */}
          <div className="grid grid-cols-5 gap-1.5 mt-2">
            {['#0f172a', '#1e1b4b', '#18181b', '#312e81', '#1e293b'].map((hex) => (
              <button
                key={hex}
                onClick={() => onUpdateBackground({ color: hex, type: 'solid' })}
                style={{ backgroundColor: hex }}
                className="w-full h-6 rounded border border-gray-700/80 hover:scale-105 transition-transform"
                title={hex}
              />
            ))}
          </div>
        </div>

        {/* Gradient presets */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-[10px] font-medium text-gray-400">Gradient</label>
            {bg.type === 'gradient' && (
              <button
                onClick={() => onUpdateBackground({ color: bg.color || '#111827', type: 'solid' })}
                className="text-[10px] text-red-400 hover:text-red-300 font-medium"
              >
                Clear
              </button>
            )}
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {backgroundGradientPresets.map((preset) => {
              const gradient = { colors: preset.colors, angle: preset.angle, type: preset.type ?? 'linear' }
              const isActive =
                bg.type === 'gradient' &&
                bg.gradient?.colors?.join() === preset.colors.join() &&
                (bg.gradient?.type ?? 'linear') === gradient.type
              return (
                <button
                  key={preset.id}
                  onClick={() => onUpdateBackground({ type: 'gradient', gradient })}
                  style={{ background: cssGradient(gradient) }}
                  className={`w-full h-8 rounded border hover:scale-105 transition-transform ${
                    isActive ? 'border-emerald-400 ring-1 ring-emerald-400' : 'border-gray-700/80'
                  }`}
                  title={preset.name}
                  aria-label={`${preset.name} gradient`}
                />
              )
            })}
          </div>
        </div>

        {/* Custom gradient */}
        <div>
          <label className="block text-[10px] font-medium text-gray-400 mb-1.5">Custom gradient</label>
          <div className="flex items-center gap-2">
            {[0, 1].map((i) => (
              <input
                key={i}
                type="color"
                aria-label={`Gradient colour ${i + 1}`}
                value={customGradient.colors[i]}
                onChange={(e) => {
                  const colors = [...customGradient.colors]
                  colors[i] = e.target.value
                  setGradient({ colors })
                }}
                className="w-8 h-8 rounded border border-gray-700 cursor-pointer bg-transparent"
              />
            ))}
            <div className="flex rounded border border-gray-700 overflow-hidden text-[10px]" role="group" aria-label="Gradient shape">
              {['linear', 'radial'].map((shape) => (
                <button
                  key={shape}
                  onClick={() => setGradient({ type: shape })}
                  aria-pressed={customGradient.type === shape}
                  className={`px-2 py-1 capitalize ${
                    customGradient.type === shape ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {shape}
                </button>
              ))}
            </div>
          </div>
          {customGradient.type === 'linear' && (
            <label className="flex items-center gap-2 mt-2 text-[10px] text-gray-400">
              Angle
              <input
                type="range"
                min={0}
                max={359}
                value={customGradient.angle}
                onChange={(e) => setGradient({ angle: Number(e.target.value) })}
                className="flex-1 accent-emerald-500"
              />
              <span className="font-mono w-8 text-right">{customGradient.angle}°</span>
            </label>
          )}
        </div>

        {/* Photo */}
        <div>
          <label className="block text-[10px] font-medium text-gray-400 mb-1.5">Photo</label>
          {speakersWithPhotos.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {speakersWithPhotos.map((s) => (
                <button
                  key={s.id}
                  onClick={() =>
                    onUpdateBackground({
                      type: 'image',
                      imageUrl: s.sourceImageUrl,
                      imageBlur: STUDIO_BLUR_PX,
                      imageDarken: STUDIO_DARKEN,
                    })
                  }
                  className="text-[10px] px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700"
                  title="Use this speaker's photo, blurred, as the background"
                >
                  Blurred {speakerLabel(project, s.id)}
                </button>
              ))}
            </div>
          )}
          {bg.type === 'image' && bg.imageUrl ? (
            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-2 text-[10px] text-gray-400">
                <span className="w-10">Blur</span>
                <input
                  type="range"
                  min={0}
                  max={40}
                  value={bg.imageBlur ?? 0}
                  onChange={(e) => onUpdateBackground({ imageBlur: Number(e.target.value) })}
                  className="flex-1 accent-emerald-500"
                />
                <span className="font-mono w-10 text-right">{bg.imageBlur ?? 0}px</span>
              </label>
              <label className="flex items-center gap-2 text-[10px] text-gray-400">
                <span className="w-10">Darken</span>
                <input
                  type="range"
                  min={0}
                  max={0.8}
                  step={0.05}
                  value={bg.imageDarken ?? 0}
                  onChange={(e) => onUpdateBackground({ imageDarken: Number(e.target.value) })}
                  className="flex-1 accent-emerald-500"
                />
                <span className="font-mono w-10 text-right">{Math.round((bg.imageDarken ?? 0) * 100)}%</span>
              </label>
            </div>
          ) : (
            <p className="text-[10px] text-gray-500">
              Upload a photo in the Background card below
              {speakersWithPhotos.length > 0 && ', or use a speaker photo above'}.
            </p>
          )}
        </div>

        {/* Vignette */}
        <label className="flex items-center gap-2 text-[10px] text-gray-400">
          <span className="font-medium">Vignette</span>
          <input
            type="range"
            min={0}
            max={0.8}
            step={0.05}
            value={bg.vignette ?? 0}
            onChange={(e) => onUpdateBackground({ vignette: Number(e.target.value) })}
            className="flex-1 accent-emerald-500"
            aria-label="Vignette strength"
          />
          <span className="font-mono w-10 text-right">{Math.round((bg.vignette ?? 0) * 100)}%</span>
        </label>
      </div>
    )
  }

  return null
}

export default PropertiesPanel
