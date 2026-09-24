import { speakerLabel } from '../../modules/thumbnail/thumbnailState'
import { withDecorLayer } from '../../modules/thumbnail/decor'
import { findElement } from '../../data/elements'

function LayersPanel({ project, selectedLayer, onSelectLayer, onReorderLayers, onToggleVisibility, onAddElement }) {
  const layerLabels = {
    text: { name: 'Headline Text', icon: 'T', color: 'text-amber-400' },
    decor: { name: 'Graphics', icon: 'G', color: 'text-pink-400' },
    background: { name: 'Background', icon: 'B', color: 'text-emerald-400' },
  }
  ;(project.stickers ?? []).forEach((sticker) => {
    layerLabels[sticker.id] = {
      name: findElement(sticker.elementId)?.name ?? 'Element',
      icon: '★',
      color: 'text-pink-400',
    }
  })
  project.speakers.forEach((speaker, i) => {
    layerLabels[speaker.id] = {
      name: speakerLabel(project, speaker.id),
      icon: String(i + 1),
      color: 'text-sky-400',
    }
  })

  // Older projects don't list the Graphics layer; show it where the canvas draws it.
  const layerOrder = withDecorLayer(project.layerOrder)
  // Visual order: top of stack first
  const displayOrder = [...layerOrder].reverse()

  const moveLayer = (layerId, direction) => {
    const currentIndex = layerOrder.indexOf(layerId)
    if (currentIndex === -1) return

    const targetIndex = direction === 'up' ? currentIndex + 1 : currentIndex - 1
    if (targetIndex < 0 || targetIndex >= layerOrder.length) return

    const newOrder = [...layerOrder]
    const temp = newOrder[currentIndex]
    newOrder[currentIndex] = newOrder[targetIndex]
    newOrder[targetIndex] = temp

    onReorderLayers(newOrder)
  }

  const isVisible = (layerId) => {
    if (layerId === 'text') return project.text.visible
    if (layerId === 'decor') return project.decor?.visible ?? true
    const sticker = project.stickers?.find((s) => s.id === layerId)
    if (sticker) return sticker.visible
    const speaker = project.speakers.find((s) => s.id === layerId)
    return speaker ? speaker.visible : true
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-3.5 flex flex-col gap-2.5 shadow-lg h-full">
      <div className="flex items-center justify-between border-b border-gray-800 pb-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
          <span>Layers</span>
          <span className="text-[10px] lowercase text-gray-500 font-normal">(top to bottom)</span>
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 font-mono">{layerOrder.length} items</span>
          <button
            onClick={onAddElement}
            className="text-[10px] px-2 py-1 rounded bg-pink-600 hover:bg-pink-500 text-white font-bold"
          >
            + Element
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 overflow-y-auto">
        {displayOrder.map((layerId) => {
          const info = layerLabels[layerId] || { name: layerId, icon: '•', color: 'text-gray-300' }
          const isSelected = selectedLayer === layerId
          const visible = isVisible(layerId)
          const actualIndex = layerOrder.indexOf(layerId)
          const canMoveUp = actualIndex < layerOrder.length - 1
          const canMoveDown = actualIndex > 0

          return (
            <div
              key={layerId}
              onClick={() => onSelectLayer(layerId)}
              className={`flex items-center justify-between px-2.5 py-2 rounded-lg text-xs cursor-pointer border transition-all select-none ${
                isSelected
                  ? 'bg-amber-500/15 border-amber-500/50 text-white shadow-sm'
                  : 'bg-gray-800/60 hover:bg-gray-850 border-gray-700/60 text-gray-300'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={`w-5 h-5 rounded flex items-center justify-center font-bold text-[10px] bg-gray-950 border border-gray-700 ${info.color}`}
                >
                  {info.icon}
                </span>
                <span className="font-medium truncate max-w-[130px]">{info.name}</span>
              </div>

              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                {/* Visibility button */}
                {layerId !== 'background' && (
                  <button
                    onClick={() => onToggleVisibility(layerId)}
                    className={`w-6 h-6 rounded flex items-center justify-center text-xs hover:bg-gray-700 transition-colors ${
                      visible ? 'text-gray-300' : 'text-gray-600'
                    }`}
                    title={visible ? 'Hide layer' : 'Show layer'}
                  >
                    {visible ? '👁' : '🚫'}
                  </button>
                )}

                {/* Move up */}
                <button
                  onClick={() => moveLayer(layerId, 'up')}
                  disabled={!canMoveUp}
                  className="w-5 h-5 rounded flex items-center justify-center text-[10px] bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:hover:bg-gray-800 text-gray-300 transition-colors"
                  title="Move layer up"
                >
                  ▲
                </button>

                {/* Move down */}
                <button
                  onClick={() => moveLayer(layerId, 'down')}
                  disabled={!canMoveDown}
                  className="w-5 h-5 rounded flex items-center justify-center text-[10px] bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:hover:bg-gray-800 text-gray-300 transition-colors"
                  title="Move layer down"
                >
                  ▼
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default LayersPanel
