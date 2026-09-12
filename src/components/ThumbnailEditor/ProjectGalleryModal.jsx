import { useState, useEffect, useRef } from 'react'
import {
  listStoredProjects,
  loadProjectFromStorage,
  deleteStoredProject,
  exportProjectToJSON,
  importProjectFromJSON,
} from '../../modules/thumbnail/thumbnailStorage'

function ProjectGalleryModal({ currentProjectId, onLoadProject, onClose }) {
  const [projects, setProjects] = useState([])
  const fileInputRef = useRef(null)

  const refreshList = () => {
    setProjects(listStoredProjects())
  }

  useEffect(() => {
    refreshList()
  }, [])

  const handleSelect = (id) => {
    const proj = loadProjectFromStorage(id)
    if (proj) {
      onLoadProject(proj)
      onClose()
    }
  }

  const handleDelete = (e, id) => {
    e.stopPropagation()
    if (confirm('Delete this project?')) {
      deleteStoredProject(id)
      refreshList()
    }
  }

  const handleExportJSON = (e, id) => {
    e.stopPropagation()
    const proj = loadProjectFromStorage(id)
    if (!proj) return
    const jsonStr = exportProjectToJSON(proj)
    const blob = new Blob([jsonStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${proj.name.replace(/\s+/g, '-').toLowerCase()}-project.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleImportJSON = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const imported = importProjectFromJSON(event.target.result)
        onLoadProject(imported)
        onClose()
      } catch (err) {
        alert(`Failed to import project: ${err.message}`)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-xl p-5 shadow-2xl flex flex-col gap-4 text-white">
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <h2 className="text-base font-bold text-gray-100 flex items-center gap-2">
            <span>📁</span>
            <span>Saved Projects</span>
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-2.5 py-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-200 rounded border border-gray-700 transition-colors"
            >
              Import JSON
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-sm font-bold w-6 h-6 flex items-center justify-center rounded hover:bg-gray-800"
            >
              ✕
            </button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleImportJSON}
        />

        {projects.length === 0 ? (
          <div className="py-12 text-center text-gray-500 text-sm">
            <p>No saved projects found in local storage.</p>
            <p className="text-xs mt-1">Use the &quot;Save&quot; button in the toolbar to store compositions.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-h-[350px] overflow-y-auto">
            {projects.map((item) => (
              <div
                key={item.id}
                onClick={() => handleSelect(item.id)}
                className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                  item.id === currentProjectId
                    ? 'bg-amber-500/15 border-amber-500/60 text-white'
                    : 'bg-gray-800/50 hover:bg-gray-800 border-gray-700/60 text-gray-300'
                }`}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-bold text-sm">{item.name}</span>
                  <span className="text-[10px] text-gray-500">
                    Updated {new Date(item.updatedAt).toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={(e) => handleExportJSON(e, item.id)}
                    className="px-2 py-1 text-xs bg-gray-700/80 hover:bg-gray-700 rounded text-gray-200 border border-gray-600 transition-colors"
                    title="Export JSON"
                  >
                    Export
                  </button>
                  <button
                    onClick={(e) => handleDelete(e, item.id)}
                    className="w-7 h-7 flex items-center justify-center text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                    title="Delete Project"
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default ProjectGalleryModal
