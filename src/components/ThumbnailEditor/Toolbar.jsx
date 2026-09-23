import { useState, useEffect } from 'react'
import { MAX_SPEAKERS, getLayoutsForCount } from '../../modules/thumbnail/layouts'
import { defaultRemoverRegistry } from '../../services/background-removal'
import { loadShowPresets } from '../../modules/shows/showPreferences'

const SPEAKER_COUNTS = Array.from({ length: MAX_SPEAKERS }, (_, i) => i + 1)

function Toolbar({
  project,
  onUpdateProjectName,
  onSelectLayout,
  onApplyShowPreset,
  onOpenShows,
  onSaveProject,
  onOpenProjects,
  onExport,
  onSetSpeakerCount,
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
  const [exportResolution, setExportResolution] = useState('hd')
  const [coreMLStatus, setCoreMLStatus] = useState('checking')

  useEffect(() => {
    const list = defaultRemoverRegistry.list()
    setAvailableRemovers(list)
    setShowPresets(loadShowPresets())

    let isMounted = true
    const checkCoreML = async () => {
      try {
        const coreML =
          defaultRemoverRegistry.get('cached-coreml-local') ||
          defaultRemoverRegistry.get('coreml-local')
        if (coreML && typeof coreML.isAvailable === 'function') {
          const available = await coreML.isAvailable()
          if (!isMounted) return
          if (available) {
            setCoreMLStatus('online')
            // Auto-activate Core ML if active remover is currently default WASM
            const currentActive = defaultRemoverRegistry.getActive()
            if (currentActive?.id?.includes('imgly')) {
              defaultRemoverRegistry.setActive(coreML.id)
              setActiveRemoverId(coreML.id)
            }
          } else {
            setCoreMLStatus('offline')
          }
        } else {
          if (isMounted) setCoreMLStatus('offline')
        }
      } catch {
        if (isMounted) setCoreMLStatus('offline')
      }
    }

    checkCoreML()
    return () => {
      isMounted = false
    }
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

  const speakerCount = project.speakers.length
  const layouts = getLayoutsForCount(speakerCount)

  return (
    <header className="w-full bg-gray-900 border-b border-gray-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-white">
      {/* Left: Branding & Project Name */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-red-600 to-amber-500 flex items-center justify-center font-black text-sm shadow-md">
            YT
          </div>
          <span className="font-bold text-sm tracking-wide hidden sm:inline text-gray-200">
            YouThumber
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

        {/* Speaker count */}
        <div
          className="flex items-center rounded border border-gray-700 overflow-hidden text-[11px]"
          role="group"
          aria-label="Number of speakers"
        >
          <span className="px-1.5 text-gray-400" aria-hidden="true">
            👥
          </span>
          {SPEAKER_COUNTS.map((n) => (
            <button
              key={n}
              onClick={() => onSetSpeakerCount(n)}
              aria-pressed={n === speakerCount}
              title={`${n} speaker${n === 1 ? '' : 's'}`}
              className={`px-2 py-0.5 font-medium transition-colors ${
                n === speakerCount
                  ? 'bg-amber-600 text-white'
                  : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
              }`}
            >
              {n}
            </button>
          ))}
        </div>

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
            value={project.layoutId}
            onChange={(e) => {
              const layout = layouts.find((l) => l.id === e.target.value)
              if (layout) onSelectLayout(layout)
            }}
            className="bg-gray-800 text-gray-200 border border-gray-700 rounded px-2 py-1 text-xs outline-none focus:border-amber-500 hover:bg-gray-750"
            title={`Layouts for ${speakerCount} speaker${speakerCount === 1 ? '' : 's'}`}
            aria-label="Layout"
          >
            {layouts.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>

        {/* Backend Model / Remover Selector & Health Badge */}
        <div className="flex items-center gap-1.5 text-xs">
          <select
            value={activeRemoverId}
            onChange={handleRemoverChange}
            className="bg-gray-800 text-gray-200 border border-gray-700 rounded px-2 py-1 text-xs outline-none focus:border-amber-500 hover:bg-gray-750 font-mono"
            title="Select local background removal engine"
          >
            {availableRemovers.map((remover) => {
              const isCoreML = remover.id.includes('coreml')
              const statusTag = isCoreML
                ? coreMLStatus === 'checking'
                  ? ' (Checking...)'
                  : coreMLStatus === 'online'
                    ? ' (Online)'
                    : ' (Offline)'
                : ''
              const icon = isCoreML ? '⚡' : remover.id.includes('mock') ? '🧪' : '🌐'
              return (
                <option key={remover.id} value={remover.id}>
                  {icon} {remover.name}
                  {statusTag}
                </option>
              )
            })}
          </select>

          {/* Health Status Indicator */}
          {coreMLStatus === 'online' ? (
            <div
              className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-950/80 border border-emerald-600/40 text-emerald-400 text-[11px] font-medium shadow-sm"
              title="Apple Neural Engine / Metal acceleration active on local port"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Core ML Online</span>
            </div>
          ) : coreMLStatus === 'offline' ? (
            <div
              className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded bg-gray-800/90 border border-gray-700/80 text-gray-400 text-[11px] font-medium"
              title="Local Core ML service not detected. Background removal runs via in-browser WebAssembly."
            >
              <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
              <span>WASM Fallback</span>
            </div>
          ) : null}
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

        {/* Resolution Selector */}
        <select
          value={exportResolution}
          onChange={(e) => setExportResolution(e.target.value)}
          className="bg-gray-800 text-gray-200 border border-gray-700 rounded px-1.5 py-1 text-xs outline-none focus:border-amber-500 font-mono"
          title="Export resolution"
        >
          <option value="hd">1280×720</option>
          <option value="fullhd">1920×1080</option>
        </select>

        {/* Export Button */}
        <button
          onClick={() => onExport({ format: exportFormat, quality: 0.95, resolution: exportResolution })}
          className="px-3 py-1 text-xs font-bold rounded bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white shadow-md transition-all active:scale-95 flex items-center gap-1.5"
        >
          <span>Export {exportResolution === 'fullhd' ? '1920×1080' : '1280×720'}</span>
        </button>
      </div>
    </header>
  )
}

export default Toolbar
