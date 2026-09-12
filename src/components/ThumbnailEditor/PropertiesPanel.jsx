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

        {/* Font Family & Size */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-medium text-gray-400 mb-1">Font Family</label>
            <select
              value={textState.fontFamily}
              onChange={(e) => onUpdateText({ fontFamily: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-amber-500"
            >
              <option value="Montserrat">Montserrat</option>
              <option value="Bebas Neue">Bebas Neue</option>
              <option value="Impact">Impact</option>
              <option value="Oswald">Oswald</option>
              <option value="Inter">Inter</option>
              <option value="Anton">Anton</option>
            </select>
          </div>

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
  if (selectedLayer === 'speaker1' || selectedLayer === 'speaker2') {
    const speaker = project[selectedLayer]
    const transform = speaker.transform

    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-3.5 flex flex-col gap-3 shadow-lg text-xs text-gray-200 overflow-y-auto max-h-[380px]">
        <div className="flex items-center justify-between border-b border-gray-800 pb-1.5">
          <h3 className="font-bold uppercase tracking-wider text-sky-400 text-[11px]">
            {speaker.name} Controls
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
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-3.5 flex flex-col gap-3 shadow-lg text-xs text-gray-200">
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
      </div>
    )
  }

  return null
}

export default PropertiesPanel
