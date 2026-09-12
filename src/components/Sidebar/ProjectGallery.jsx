import { useState, useEffect, useRef } from 'react'
import { getAllProjects, deleteProject, duplicateProject, getStorageInfo, exportProjectsToJSON, importProjectsFromJSON } from '../../utils/storageUtils'

function ProjectGallery({ currentProjectId, onSave, onLoad, onNew }) {
  const [projects, setProjects] = useState([])
  const [projectName, setProjectName] = useState('')
  const [showGallery, setShowGallery] = useState(false)
  const [storageInfo, setStorageInfo] = useState({ projectCount: 0, sizeInKB: '0' })
  const [viewMode, setViewMode] = useState('grid') // 'grid' or 'list'
  const [filterFormat, setFilterFormat] = useState('all') // 'all', '16:9', '9:16'
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('date') // 'date' or 'name'
  const [isImporting, setIsImporting] = useState(false)
  const importInputRef = useRef(null)

  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjects = () => {
    const savedProjects = getAllProjects()
    setProjects(savedProjects)
    setStorageInfo(getStorageInfo())
  }

  const handleSave = () => {
    const name = projectName.trim() || `Project ${new Date().toLocaleString()}`
    onSave(name)
    setProjectName('')
    // Reload after a short delay to get the new thumbnail
    setTimeout(loadProjects, 100)
  }

  const handleLoad = (project) => {
    onLoad(project)
    setShowGallery(false)
  }

  const handleDelete = (e, projectId) => {
    e.stopPropagation()
    if (confirm('Delete this project?')) {
      deleteProject(projectId)
      loadProjects()
    }
  }

  const handleDuplicate = (e, projectId) => {
    e.stopPropagation()
    const result = duplicateProject(projectId)
    if (result.success) {
      loadProjects()
    } else {
      alert(`Failed to duplicate: ${result.error}`)
    }
  }

  const handleNew = () => {
    onNew()
    setShowGallery(false)
  }

  const handleExport = () => {
    const result = exportProjectsToJSON()
    if (result.success) {
      alert(`Exported ${result.count} project(s) successfully!`)
    } else {
      alert(`Export failed: ${result.error}`)
    }
  }

  const handleImportClick = () => {
    importInputRef.current?.click()
  }

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const mode = projects.length > 0
      ? confirm('You have existing projects.\n\nOK = Merge (keep existing + add new)\nCancel = Replace all')
        ? 'merge'
        : 'replace'
      : 'replace'

    setIsImporting(true)
    const result = await importProjectsFromJSON(file, mode)
    setIsImporting(false)

    if (result.success) {
      loadProjects()
      let message = `Imported ${result.imported} project(s) successfully!`
      if (result.skipped > 0) {
        message += `\n${result.skipped} duplicate(s) skipped.`
      }
      alert(message)
    } else {
      alert(`Import failed: ${result.error}`)
    }

    // Reset input
    e.target.value = ''
  }

  // Filter and sort projects
  const filteredProjects = projects
    .filter(project => {
      // Format filter
      if (filterFormat !== 'all' && project.format !== filterFormat) {
        return false
      }
      // Search filter
      if (searchQuery && !project.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false
      }
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name)
      }
      // Sort by date (newest first)
      return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)
    })

  return (
    <section>
      <h2 className="text-lg font-semibold mb-3 text-[#E67E22]">
        Projects
      </h2>

      <div className="space-y-3">
        {/* Save Current Project */}
        <div>
          <label className="block text-sm mb-1 text-gray-400">
            Project Name
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="My Thumbnail"
              className="flex-1 min-w-0 bg-gray-700 px-3 py-2 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#E67E22]"
            />
            <button
              onClick={handleSave}
              className="px-3 py-2 bg-[#E67E22] text-white rounded text-sm font-medium hover:bg-[#d35400] transition-colors whitespace-nowrap flex-shrink-0"
            >
              Save
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setShowGallery(!showGallery)}
            className="px-3 py-2 bg-gray-700 text-white rounded text-sm hover:bg-gray-600 transition-colors flex items-center justify-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            Gallery ({projects.length})
          </button>
          <button
            onClick={handleNew}
            className="px-3 py-2 bg-gray-700 text-white rounded text-sm hover:bg-gray-600 transition-colors"
          >
            New Project
          </button>
        </div>

        {/* Gallery Panel */}
        {showGallery && (
          <div className="border border-gray-700 rounded overflow-hidden">
            {/* Gallery Controls */}
            <div className="bg-gray-800 p-2 space-y-2">
              {/* Search */}
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search projects..."
                className="w-full bg-gray-700 px-3 py-1.5 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#E67E22]"
              />

              {/* Filters Row */}
              <div className="flex items-center gap-2">
                {/* Format Filter */}
                <select
                  value={filterFormat}
                  onChange={(e) => setFilterFormat(e.target.value)}
                  className="bg-gray-700 text-white text-xs px-2 py-1 rounded focus:outline-none"
                >
                  <option value="all">All Formats</option>
                  <option value="16:9">16:9</option>
                  <option value="9:16">9:16</option>
                </select>

                {/* Sort */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-gray-700 text-white text-xs px-2 py-1 rounded focus:outline-none"
                >
                  <option value="date">Newest</option>
                  <option value="name">Name</option>
                </select>

                {/* View Toggle */}
                <div className="flex ml-auto">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1 rounded-l ${viewMode === 'grid' ? 'bg-[#E67E22]' : 'bg-gray-700'}`}
                    title="Grid view"
                  >
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-1 rounded-r ${viewMode === 'list' ? 'bg-[#E67E22]' : 'bg-gray-700'}`}
                    title="List view"
                  >
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Projects Display */}
            <div className="max-h-80 overflow-y-auto p-2">
              {filteredProjects.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">
                  {projects.length === 0 ? 'No saved projects' : 'No matching projects'}
                </p>
              ) : viewMode === 'grid' ? (
                /* Grid View */
                <div className="grid grid-cols-2 gap-2">
                  {filteredProjects.map((project) => (
                    <div
                      key={project.id}
                      onClick={() => handleLoad(project)}
                      className={`cursor-pointer rounded overflow-hidden transition-all hover:ring-2 hover:ring-[#E67E22] ${
                        project.id === currentProjectId ? 'ring-2 ring-[#E67E22]' : ''
                      }`}
                    >
                      {/* Thumbnail */}
                      <div className={`bg-gray-800 relative ${project.format === '16:9' ? 'aspect-video' : 'aspect-[9/16]'}`}>
                        {project.thumbnail ? (
                          <img
                            src={project.thumbnail}
                            alt={project.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-600">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                        {/* Format Badge */}
                        <span className="absolute top-1 left-1 bg-black/70 text-white text-[10px] px-1 rounded">
                          {project.format}
                        </span>
                        {/* Action Buttons */}
                        <div className="absolute top-1 right-1 flex gap-0.5">
                          <button
                            onClick={(e) => handleDuplicate(e, project.id)}
                            className="bg-blue-600/80 hover:bg-blue-600 text-white p-0.5 rounded transition-colors"
                            title="Duplicate"
                          >
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M7 9a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9z" />
                              <path d="M5 3a2 2 0 00-2 2v6a2 2 0 002 2V5h8a2 2 0 00-2-2H5z" />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => handleDelete(e, project.id)}
                            className="bg-red-600/80 hover:bg-red-600 text-white p-0.5 rounded transition-colors"
                            title="Delete"
                          >
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      {/* Project Info */}
                      <div className="bg-gray-700 p-1.5">
                        <p className="text-xs text-white truncate font-medium">{project.name}</p>
                        <p className="text-[10px] text-gray-400">
                          {new Date(project.updatedAt || project.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* List View */
                <div className="space-y-2">
                  {filteredProjects.map((project) => (
                    <div
                      key={project.id}
                      onClick={() => handleLoad(project)}
                      className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                        project.id === currentProjectId
                          ? 'bg-[#E67E22] bg-opacity-20 border border-[#E67E22]'
                          : 'bg-gray-700 hover:bg-gray-600'
                      }`}
                    >
                      {/* Mini Thumbnail */}
                      <div className={`flex-shrink-0 bg-gray-800 rounded overflow-hidden ${project.format === '16:9' ? 'w-12 h-7' : 'w-7 h-12'}`}>
                        {project.thumbnail ? (
                          <img
                            src={project.thumbnail}
                            alt={project.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-600">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      {/* Project Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{project.name}</p>
                        <p className="text-xs text-gray-400">
                          {project.format} • {new Date(project.updatedAt || project.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      {/* Action Buttons */}
                      <div className="flex-shrink-0 flex gap-1">
                        <button
                          onClick={(e) => handleDuplicate(e, project.id)}
                          className="p-1.5 bg-blue-600/80 hover:bg-blue-600 text-white rounded transition-colors"
                          title="Duplicate"
                        >
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M7 9a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9z" />
                            <path d="M5 3a2 2 0 00-2 2v6a2 2 0 002 2V5h8a2 2 0 00-2-2H5z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => handleDelete(e, project.id)}
                          className="p-1.5 bg-red-600/80 hover:bg-red-600 text-white rounded transition-colors"
                          title="Delete"
                        >
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Backup Controls */}
        <div className="border-t border-gray-700 pt-3">
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              disabled={projects.length === 0}
              className="flex-1 px-2 py-1.5 bg-gray-700 text-white rounded text-xs hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
              title="Export all projects as JSON backup"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export
            </button>
            <button
              onClick={handleImportClick}
              disabled={isImporting}
              className="flex-1 px-2 py-1.5 bg-gray-700 text-white rounded text-xs hover:bg-gray-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
              title="Import projects from JSON backup"
            >
              {isImporting ? (
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              )}
              Import
            </button>
          </div>
          <input
            ref={importInputRef}
            type="file"
            accept=".json"
            onChange={handleImportFile}
            className="hidden"
          />
          <p className="text-xs text-gray-500 mt-2">
            💾 {storageInfo.projectCount} projects • {storageInfo.sizeInKB} KB used
          </p>
        </div>
      </div>
    </section>
  )
}

export default ProjectGallery
