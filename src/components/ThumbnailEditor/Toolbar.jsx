import { useState, useEffect } from 'react'
import { PRESET_TEMPLATES } from '../../modules/thumbnail/templates'
import { defaultRemoverRegistry } from '../../services/background-removal'
import { loadShowPresets } from '../../modules/shows/showPreferences'

function Toolbar({
  project,
  onUpdateProjectName,
  onSelectTemplate,
  onApplyShowPreset,
  onOpenShows,
  onSaveProject,
  onOpenProjects,
  onExport,
  onToggleSpeakerCount,
}) {
  const [activeRemoverId, setActiveRemoverId] = useState(() => {
    try {
      return defaultRemoverRegistry.getActive().id
    } catch {
      return 'imgly-wasm'
    }
  })
  const [availableRemovers, setAvailableRemovers] = useState([])
  const [showPresets, setShowPresets] = useState([])
  const [exportFormat, setExportFormat] = useState('jpeg')

  useEffect(() => {
    const list = defaultRemoverRegistry.list()
    setAvailableRemovers(list)
    setShowPresets(loadShowPresets())
  }, [])

  const handleRemoverChange = (e) => {
    const newId = e.target.value
    setActiveRemoverId(newId)
    try {
      defaultRemoverRegistry.setActive(newId)
    } catch (err) {
      console.error(err)
    }
  }

  const isSingleSpeaker = !project.speaker2.visible

  return (
    <header className="w-full bg-gray-900 border-b border-gray-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-white">
      {/* Left: Branding & Project Name */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-red-600 to-amber-500 flex items-center justify-center font-black text-sm shadow-md">
            YT
          </div>
          <span className="font-bold text-sm tracking-wide hidden sm:inline text-gray-200">
            Thumbnail Studio
          </span>
        </div>

        <div className="h-5 w-px bg-gray-700 hidden sm:block" />

        <input
          type="text"
          value={project.name}
          onChange={(e) => onUpdateProjectName(e.target.value)}
          placeholder="Untitled Project"
          className="bg-gray-800/80 hover:bg-gray-800 focus:bg-gray-950 px-2.5 py-1 rounded text-xs sm:text-sm font-medium border border-gray-700 focus:border-amber-500 outline-none text-gray-100 transition-colors w-36 sm:w-52"
        />

        {/* 1 Speaker vs 2 Speakers Quick Switcher */}
        <button
          onClick={onToggleSpeakerCount}
          className="px-2 py-0.5 rounded text-[11px] font-medium bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 transition-colors hidden md:flex items-center gap-1"
          title="Toggle between 1 or 2 speakers"
        >
          <span>👥</span>
          <span>{isSingleSpeaker ? '1 Speaker' : '2 Speakers'}</span>
        </button>

        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700/60 hidden lg:inline">
          1280 × 720
        </span>
      </div>

      {/* Middle: Per-Show Presets & Templates */}
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
        {/* Show Presets Switcher */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-gray-400 font-medium hidden lg:inline">Show:</span>
          <select
            onChange={(e) => {
              const show = showPresets.find((p) => p.id === e.target.value)
              if (show) onApplyShowPreset(show)
            }}
            defaultValue=""
            className="bg-gray-800 text-amber-300 font-semibold border border-gray-700 rounded px-2 py-1 text-xs outline-none focus:border-amber-500 hover:bg-gray-750"
            title="Load saved show styling and layout preferences"
          >
            <option value="" disabled>
              Select Show Preset...
            </option>
            {showPresets.map((s) => (
              <option key={s.id} value={s.id}>
                📺 {s.name} ({s.speakerCount}P)
              </option>
            ))}
          </select>

          <button
            onClick={onOpenShows}
            className="px-2 py-1 text-[11px] font-bold rounded bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 border border-amber-600/40 transition-colors"
            title="Manage saved show preferences"
          >
            Manage Shows
          </button>
        </div>

        {/* Template Selector */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-gray-400 font-medium hidden xl:inline">Layout:</span>
          <select
            onChange={(e) => {
              const tmpl = PRESET_TEMPLATES.find((t) => t.id === e.target.value)
              if (tmpl) onSelectTemplate(tmpl)
            }}
            defaultValue=""
            className="bg-gray-800 text-gray-200 border border-gray-700 rounded px-2 py-1 text-xs outline-none focus:border-amber-500 hover:bg-gray-750"
          >
            <option value="" disabled>
              Layout Preset...
            </option>
            {PRESET_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        {/* Backend Model / Remover Selector */}
        <div className="flex items-center gap-1.5 text-xs">
          <select
            value={activeRemoverId}
            onChange={handleRemoverChange}
            className="bg-gray-800 text-gray-300 border border-gray-700 rounded px-2 py-1 text-xs outline-none focus:border-amber-500 hover:bg-gray-750 font-mono"
            title="Select local background removal backend"
          >
            {availableRemovers.map((remover) => (
              <option key={remover.id} value={remover.id}>
                ⚙️ {remover.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenProjects}
          className="px-2.5 py-1 text-xs font-medium rounded bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 transition-colors"
          title="Open Project Manager"
        >
          Projects
        </button>

        <button
          onClick={onSaveProject}
          className="px-2.5 py-1 text-xs font-medium rounded bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 transition-colors"
          title="Save to local storage"
        >
          Save
        </button>

        <div className="h-5 w-px bg-gray-700" />

        {/* Format Selector */}
        <select
          value={exportFormat}
          onChange={(e) => setExportFormat(e.target.value)}
          className="bg-gray-800 text-gray-200 border border-gray-700 rounded px-1.5 py-1 text-xs outline-none focus:border-amber-500 font-mono"
        >
          <option value="jpeg">JPG</option>
          <option value="png">PNG</option>
        </select>

        {/* Export Button */}
        <button
          onClick={() => onExport({ format: exportFormat, quality: 0.95 })}
          className="px-3 py-1 text-xs font-bold rounded bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white shadow-md transition-all active:scale-95 flex items-center gap-1.5"
        >
          <span>Export 1280×720</span>
        </button>
      </div>
    </header>
  )
}

export default Toolbar
