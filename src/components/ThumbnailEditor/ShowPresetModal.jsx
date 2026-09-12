import { useState, useEffect } from 'react'
import {
  loadShowPresets,
  saveShowPreset,
  deleteShowPreset,
  createShowPresetFromProject,
} from '../../modules/shows/showPreferences'

function ShowPresetModal({ currentProject, onApplyShow, onClose }) {
  const [presets, setPresets] = useState([])
  const [newShowName, setNewShowName] = useState('')
  const [showSaveDialog, setShowSaveDialog] = useState(false)

  const refreshList = () => {
    setPresets(loadShowPresets())
  }

  useEffect(() => {
    refreshList()
  }, [])

  const handleApply = (preset) => {
    onApplyShow(preset)
    onClose()
  }

  const handleDelete = (e, id) => {
    e.stopPropagation()
    if (confirm('Delete this show preset?')) {
      deleteShowPreset(id)
      refreshList()
    }
  }

  const handleSaveCurrentAsShow = (e) => {
    e.preventDefault()
    if (!newShowName.trim()) return

    const newPreset = createShowPresetFromProject(newShowName.trim(), currentProject)
    saveShowPreset(newPreset)
    setNewShowName('')
    setShowSaveDialog(false)
    refreshList()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg p-5 shadow-2xl flex flex-col gap-4 text-white">
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">📺</span>
            <div>
              <h2 className="text-base font-bold text-gray-100">Per-Show Saved Preferences</h2>
              <p className="text-[11px] text-gray-400">
                Preset styles (speaker count, background, typography) for recurring shows
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-sm font-bold w-6 h-6 flex items-center justify-center rounded hover:bg-gray-800"
          >
            ✕
          </button>
        </div>

        {/* Save Current Configuration Button */}
        {!showSaveDialog ? (
          <button
            onClick={() => setShowSaveDialog(true)}
            className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-amber-600 to-red-600 hover:from-amber-500 hover:to-red-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2"
          >
            <span>💾 Save Current Style as New Show Preset</span>
          </button>
        ) : (
          <form
            onSubmit={handleSaveCurrentAsShow}
            className="p-3 bg-gray-800/80 rounded-xl border border-gray-700 flex flex-col gap-2"
          >
            <label className="text-xs font-semibold text-gray-200">Show Name:</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newShowName}
                onChange={(e) => setNewShowName(e.target.value)}
                placeholder="e.g., Weekly Tech Breakdown"
                autoFocus
                className="flex-1 bg-gray-950 border border-gray-700 rounded px-2.5 py-1.5 text-xs text-white outline-none focus:border-amber-500"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-gray-950 font-bold text-xs rounded transition-colors"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setShowSaveDialog(false)}
                className="px-2.5 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Preset List */}
        <div className="flex flex-col gap-2 max-h-[320px] overflow-y-auto">
          {presets.map((item) => (
            <div
              key={item.id}
              onClick={() => handleApply(item)}
              className="flex items-center justify-between p-3 rounded-xl border border-gray-800 bg-gray-800/40 hover:bg-gray-800 hover:border-gray-700 cursor-pointer transition-all group"
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-gray-100 group-hover:text-amber-400 transition-colors">
                    {item.name}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-300 font-mono border border-gray-700">
                    {item.speakerCount === 1 ? '1 Speaker' : '2 Speakers'}
                  </span>
                </div>

                {/* Preferences badge overview */}
                <div className="flex items-center gap-2 text-[11px] text-gray-400 font-mono">
                  <span className="flex items-center gap-1">
                    <span
                      className="w-3 h-3 rounded-full border border-gray-600"
                      style={{ backgroundColor: item.background.color }}
                    />
                    <span>Bg</span>
                  </span>
                  <span>•</span>
                  <span>
                    Font: <strong className="text-gray-200">{item.text.fontFamily}</strong>
                  </span>
                  <span>•</span>
                  <span style={{ color: item.text.fillColor }}>Aa Color</span>
                </div>
              </div>

              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => handleApply(item)}
                  className="px-2.5 py-1 text-xs font-semibold bg-gray-700 hover:bg-gray-600 rounded text-gray-200 transition-colors"
                >
                  Apply
                </button>

                {!item.id.startsWith('preset_') && (
                  <button
                    onClick={(e) => handleDelete(e, item.id)}
                    className="w-7 h-7 flex items-center justify-center text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                    title="Delete Show Preset"
                  >
                    🗑
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default ShowPresetModal
