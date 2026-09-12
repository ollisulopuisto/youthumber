import { useState, useRef, useEffect, useCallback } from 'react'
import UploadPanel from './components/Sidebar/UploadPanel'
import TemplateSelector from './components/Sidebar/TemplateSelector'
import FontSelector from './components/Sidebar/FontSelector'
import TextColorPicker from './components/Sidebar/TextColorPicker'
import BadgeEditor from './components/Sidebar/BadgeEditor'
import FilterPanel from './components/Sidebar/FilterPanel'
import LayerPanel from './components/Sidebar/LayerPanel'
import ExportPanel from './components/Sidebar/ExportPanel'
import ProjectGallery from './components/Sidebar/ProjectGallery'
import ThumbnailCanvas from './components/Canvas/ThumbnailCanvas'
import StorageWarning from './components/StorageWarning'
import StorageIndicator from './components/StorageIndicator'
import AutoSaveIndicator from './components/AutoSaveIndicator'
import templates from './data/templates'
import { exportCanvas } from './utils/exportUtils'
import { saveProject, createProjectFromState, loadAutoSave, clearAutoSave, generateThumbnail } from './utils/storageUtils'
import useAutoSave from './hooks/useAutoSave'
import useHistory from './hooks/useHistory'

function App() {
  const [currentProjectId, setCurrentProjectId] = useState(null)
  const [uploadedImage, setUploadedImage] = useState(null)
  const [selectedTemplate, setSelectedTemplate] = useState(templates[0]) // Default to first template
  const [format, setFormat] = useState('16:9') // '16:9' or '9:16'
  const [titleText, setTitleText] = useState('')
  const [subtitleText, setSubtitleText] = useState('')
  const [extraText, setExtraText] = useState('')
  const [fontConfig, setFontConfig] = useState({
    titleFont: 'Bebas Neue',
    subtitleFont: 'Montserrat',
    titleSize: 72,
    subtitleSize: 36
  })
  const [textColors, setTextColors] = useState({
    titleColor: null, // null = use template default
    subtitleColor: null
  })
  const [textPositions, setTextPositions] = useState({
    title: null, // null = use template default
    subtitle: null
  })
  const [badgeConfig, setBadgeConfig] = useState({
    enabled: false,
    style: 'futuristic',
    position: 'top-right',
    text: 'AI Generated',
    transparentBg: true,
    backgroundColor: '#667eea'
  })
  const [filterConfig, setFilterConfig] = useState({
    brightness: 0,
    contrast: 0,
    saturation: 0,
    blur: 0
  })
  const [layers, setLayers] = useState([])
  const canvasRef = useRef(null)
  const isRestoringHistory = useRef(false)

  // Get current editable state for history
  const getEditableState = useCallback(() => ({
    titleText,
    subtitleText,
    extraText,
    fontConfig,
    textColors,
    textPositions,
    badgeConfig,
    filterConfig,
    selectedTemplate,
    format
  }), [titleText, subtitleText, extraText, fontConfig, textColors, textPositions, badgeConfig, filterConfig, selectedTemplate, format])

  // Handle history state restoration
  const handleHistoryRestore = useCallback((state) => {
    if (!state) return
    isRestoringHistory.current = true
    setTitleText(state.titleText)
    setSubtitleText(state.subtitleText)
    setExtraText(state.extraText || '')
    setFontConfig(state.fontConfig)
    setTextColors(state.textColors)
    setTextPositions(state.textPositions)
    setBadgeConfig(state.badgeConfig)
    setFilterConfig(state.filterConfig || { brightness: 0, contrast: 0, saturation: 0, blur: 0 })
    setSelectedTemplate(state.selectedTemplate)
    setFormat(state.format)
    // Reset flag after state updates
    setTimeout(() => {
      isRestoringHistory.current = false
    }, 0)
  }, [])

  // Initialize history with current state
  const initialHistoryState = {
    titleText: '',
    subtitleText: '',
    extraText: '',
    fontConfig: { titleFont: 'Bebas Neue', subtitleFont: 'Montserrat', titleSize: 72, subtitleSize: 36 },
    textColors: { titleColor: null, subtitleColor: null },
    textPositions: { title: null, subtitle: null, extra: null },
    badgeConfig: { enabled: false, style: 'futuristic', position: 'top-right', text: 'AI Generated', transparentBg: true, backgroundColor: '#667eea' },
    filterConfig: { brightness: 0, contrast: 0, saturation: 0, blur: 0 },
    selectedTemplate: templates[0],
    format: '16:9'
  }

  const { pushState, undo, redo, canUndo, canRedo } = useHistory(initialHistoryState, handleHistoryRestore)

  // Push state to history when editable state changes (debounced)
  useEffect(() => {
    if (isRestoringHistory.current) return

    const timeoutId = setTimeout(() => {
      pushState(getEditableState())
    }, 500) // Debounce 500ms

    return () => clearTimeout(timeoutId)
  }, [titleText, subtitleText, extraText, fontConfig, textColors, badgeConfig, filterConfig, selectedTemplate, format])

  // Auto-save state
  const autoSaveState = {
    format,
    uploadedImage,
    selectedTemplate,
    titleText,
    subtitleText,
    extraText,
    fontConfig,
    textColors,
    textPositions,
    badgeConfig,
    filterConfig,
    layers
  }

  const { saveStatus, lastSaved } = useAutoSave(autoSaveState, true)

  // Restore auto-save on mount
  useEffect(() => {
    const autoSave = loadAutoSave()
    if (autoSave && autoSave.uploadedImage) {
      const shouldRestore = window.confirm(
        'An unsaved project was found. Do you want to restore it?'
      )
      if (shouldRestore) {
        const template = templates.find(t => t.id === autoSave.templateId) || templates[0]
        setFormat(autoSave.format || '16:9')
        setUploadedImage(autoSave.uploadedImage)
        setSelectedTemplate(template)
        setTitleText(autoSave.titleText || '')
        setSubtitleText(autoSave.subtitleText || '')
        setExtraText(autoSave.extraText || '')
        setFontConfig(autoSave.fontConfig || {
          titleFont: 'Bebas Neue',
          subtitleFont: 'Montserrat',
          titleSize: 72,
          subtitleSize: 36
        })
        setTextColors(autoSave.textColors || { titleColor: null, subtitleColor: null })
        setTextPositions(autoSave.textPositions || { title: null, subtitle: null })
        setBadgeConfig(autoSave.badgeConfig || {
          enabled: false,
          style: 'futuristic',
          position: 'top-right',
          text: 'AI Generated',
          transparentBg: true,
          backgroundColor: '#667eea'
        })
        setFilterConfig(autoSave.filterConfig || {
          brightness: 0,
          contrast: 0,
          saturation: 0,
          blur: 0
        })
        setLayers(autoSave.layers || [])
      } else {
        clearAutoSave()
      }
    }
  }, [])

  const handleImageUpload = (imageUrl) => {
    setUploadedImage(imageUrl)
  }

  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template)
  }

  const handleFontChange = (newFontConfig) => {
    setFontConfig(newFontConfig)
  }

  const handleBadgeChange = (newBadgeConfig) => {
    setBadgeConfig(newBadgeConfig)
  }

  const handleTextColorChange = (newTextColors) => {
    setTextColors(newTextColors)
  }

  const handleTextPositionChange = (newTextPositions) => {
    setTextPositions(newTextPositions)
  }

  const handleSaveProject = (projectName) => {
    // Generate thumbnail from canvas
    let thumbnail = null
    if (canvasRef.current) {
      const canvas = canvasRef.current.getCanvas()
      if (canvas) {
        thumbnail = generateThumbnail(canvas, format)
      }
    }

    const currentState = {
      id: currentProjectId,
      format,
      uploadedImage,
      selectedTemplate,
      titleText,
      subtitleText,
      extraText,
      fontConfig,
      textColors,
      textPositions,
      badgeConfig,
      filterConfig,
      layers
    }

    const project = createProjectFromState(currentState, projectName, thumbnail)
    const success = saveProject(project)

    if (success) {
      setCurrentProjectId(project.id)
      alert(`Project "${project.name}" saved successfully!`)
    } else {
      alert('Failed to save project. Please try again.')
    }
  }

  const handleLoadProject = (project) => {
    // Find the template by ID from the templates array
    const template = templates.find(t => t.id === project.templateId) || templates[0]

    setCurrentProjectId(project.id)
    setFormat(project.format)
    setUploadedImage(project.uploadedImage)
    setSelectedTemplate(template) // Use template from templates array
    setTitleText(project.titleText)
    setSubtitleText(project.subtitleText)
    setExtraText(project.extraText || '')
    setFontConfig(project.fontConfig)
    setTextColors(project.textColors)
    setTextPositions(project.textPositions || { title: null, subtitle: null, extra: null })
    setBadgeConfig(project.badgeConfig)
    setFilterConfig(project.filterConfig || { brightness: 0, contrast: 0, saturation: 0, blur: 0 })
    setLayers(project.layers || [])
    alert(`Project "${project.name}" loaded successfully!`)
  }

  const handleNewProject = () => {
    if (confirm('Create new project? Any unsaved changes will be lost.')) {
      setCurrentProjectId(null)
      setFormat('16:9')
      setUploadedImage(null)
      setSelectedTemplate(templates[0])
      setTitleText('')
      setSubtitleText('')
      setExtraText('')
      setFontConfig({
        titleFont: 'Bebas Neue',
        subtitleFont: 'Montserrat',
        titleSize: 72,
        subtitleSize: 36
      })
      setTextColors({
        titleColor: null,
        subtitleColor: null
      })
      setTextPositions({
        title: null,
        subtitle: null,
        extra: null
      })
      setBadgeConfig({
        enabled: false,
        style: 'futuristic',
        position: 'top-right',
        text: 'AI Generated',
        transparentBg: true,
        backgroundColor: '#667eea'
      })
      setFilterConfig({
        brightness: 0,
        contrast: 0,
        saturation: 0,
        blur: 0
      })
      setLayers([])
    }
  }

  const handleFilterChange = (newFilterConfig) => {
    setFilterConfig(newFilterConfig)
  }

  const handleAddLayer = (imageUrl) => {
    const newLayer = {
      id: `layer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      imageUrl,
      left: 100,
      top: 100,
      scaleX: 0.5,
      scaleY: 0.5,
      angle: 0
    }
    setLayers(prev => [...prev, newLayer])
  }

  const handleUpdateLayer = (layerId, updates) => {
    setLayers(prev => prev.map(layer =>
      layer.id === layerId ? { ...layer, ...updates } : layer
    ))
  }

  const handleDeleteLayer = (layerId) => {
    setLayers(prev => prev.filter(layer => layer.id !== layerId))
  }

  const handleReorderLayers = (newLayers) => {
    setLayers(newLayers)
  }

  const handleExport = useCallback((options) => {
    if (!canvasRef.current) {
      alert('Canvas not ready. Please wait a moment and try again.')
      return
    }

    const canvas = canvasRef.current.getCanvas()
    if (!canvas) {
      alert('Canvas not available. Please try again.')
      return
    }

    exportCanvas(canvas, options)
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if typing in an input field
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return
      }

      // Ctrl+S: Quick save
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault()
        if (currentProjectId) {
          // Update existing project
          handleSaveProject(null) // Will use existing name
        } else {
          // Prompt for project name
          const projectName = prompt('Enter project name:')
          if (projectName) {
            handleSaveProject(projectName)
          }
        }
      }

      // Ctrl+E: Export with default options (JPEG 90%)
      if (e.ctrlKey && e.key === 'e') {
        e.preventDefault()
        handleExport({ format: 'jpeg', quality: 0.9 })
      }

      // Delete: Remove selected canvas object
      if (e.key === 'Delete') {
        e.preventDefault()
        if (canvasRef.current) {
          const canvas = canvasRef.current.getCanvas()
          if (canvas) {
            const activeObject = canvas.getActiveObject()
            if (activeObject) {
              canvas.remove(activeObject)
              canvas.renderAll()
            }
          }
        }
      }

      // Ctrl+Z: Undo (already handled by useHistory but ensure it works globally)
      if (e.ctrlKey && !e.shiftKey && e.key === 'z') {
        e.preventDefault()
        undo()
      }

      // Ctrl+Shift+Z or Ctrl+Y: Redo
      if ((e.ctrlKey && e.shiftKey && e.key === 'z') || (e.ctrlKey && e.key === 'y')) {
        e.preventDefault()
        redo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentProjectId, undo, redo])

  return (
    <div className="h-screen bg-[#1a1a1a] flex flex-col">
      {/* Header */}
      <header className="bg-[#2a2a2a] border-b border-gray-700 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="text-2xl font-bold text-white">
              <span>Pix</span>
              <span className="text-red-500">3</span>
              <span className="text-blue-500">l</span>
              <span>Cover</span>
            </div>
            <span className="text-xs text-gray-500">v1.3.0</span>
          </div>
          <div className="flex items-center gap-3">
            {/* Undo/Redo Buttons */}
            <div className="flex items-center gap-1">
              <button
                onClick={undo}
                disabled={!canUndo}
                className="p-1.5 rounded hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Undo (Ctrl+Z)"
              >
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
              </button>
              <button
                onClick={redo}
                disabled={!canRedo}
                className="p-1.5 rounded hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Redo (Ctrl+Shift+Z)"
              >
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
                </svg>
              </button>
            </div>
            <AutoSaveIndicator status={saveStatus} lastSaved={lastSaved} />
          </div>
        </div>
      </header>

      {/* Storage Warning Banner */}
      <StorageWarning />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-80 bg-[#2a2a2a] border-r border-gray-700 flex flex-col">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Project Gallery */}
            <ProjectGallery
              currentProjectId={currentProjectId}
              onSave={handleSaveProject}
              onLoad={handleLoadProject}
              canvasRef={canvasRef}
              onNew={handleNewProject}
            />

            {/* Upload Panel */}
            <UploadPanel onImageUpload={handleImageUpload} />

            {/* Filter Panel */}
            <FilterPanel
              filterConfig={filterConfig}
              onFilterChange={handleFilterChange}
            />

            {/* Layer Panel */}
            <LayerPanel
              layers={layers}
              onAddLayer={handleAddLayer}
              onUpdateLayer={handleUpdateLayer}
              onDeleteLayer={handleDeleteLayer}
              onReorderLayers={handleReorderLayers}
            />

            {/* Format Selector */}
            <section>
              <h2 className="text-lg font-semibold mb-3 text-[#E67E22]">
                Format
              </h2>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setFormat('16:9')}
                  className={`
                    px-4 py-3 rounded text-sm font-medium transition-colors
                    ${format === '16:9'
                      ? 'bg-[#E67E22] text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }
                  `}
                >
                  <div className="font-semibold">16:9</div>
                  <div className="text-xs opacity-75 mt-1">Landscape</div>
                  <div className="text-xs opacity-75">1920x1080</div>
                </button>
                <button
                  onClick={() => setFormat('9:16')}
                  className={`
                    px-4 py-3 rounded text-sm font-medium transition-colors
                    ${format === '9:16'
                      ? 'bg-[#E67E22] text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }
                  `}
                >
                  <div className="font-semibold">9:16</div>
                  <div className="text-xs opacity-75 mt-1">Portrait</div>
                  <div className="text-xs opacity-75">1080x1920</div>
                </button>
              </div>
              <div className="text-xs text-gray-500 mt-2">
                {format === '16:9' ? '📺 Standard YouTube videos' : '📱 YouTube Shorts'}
              </div>
            </section>

            {/* Templates Panel */}
            <TemplateSelector
              selectedTemplate={selectedTemplate}
              onSelectTemplate={handleTemplateSelect}
              currentState={{ selectedTemplate, fontConfig, textColors }}
            />

            {/* Text Panel */}
            <section>
              <h2 className="text-lg font-semibold mb-3 text-[#E67E22]">
                Text
              </h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm mb-1 text-gray-400">
                    Title
                  </label>
                  <input
                    type="text"
                    value={titleText}
                    onChange={(e) => setTitleText(e.target.value)}
                    placeholder="Your blues title..."
                    className="w-full bg-gray-700 px-3 py-2 rounded text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#E67E22]"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1 text-gray-400">
                    Subtitle (optional)
                  </label>
                  <input
                    type="text"
                    value={subtitleText}
                    onChange={(e) => setSubtitleText(e.target.value)}
                    placeholder="Subtitle..."
                    className="w-full bg-gray-700 px-3 py-2 rounded text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#E67E22]"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1 text-gray-400">
                    Extra line (optional)
                  </label>
                  <input
                    type="text"
                    value={extraText}
                    onChange={(e) => setExtraText(e.target.value)}
                    placeholder="Additional text..."
                    className="w-full bg-gray-700 px-3 py-2 rounded text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#E67E22]"
                  />
                </div>
              </div>
            </section>

            {/* Font Selector */}
            <FontSelector
              titleFont={fontConfig.titleFont}
              subtitleFont={fontConfig.subtitleFont}
              titleSize={fontConfig.titleSize}
              subtitleSize={fontConfig.subtitleSize}
              onFontChange={handleFontChange}
            />

            {/* Text Color Picker */}
            <TextColorPicker
              titleColor={textColors.titleColor}
              subtitleColor={textColors.subtitleColor}
              selectedTemplate={selectedTemplate}
              onColorChange={handleTextColorChange}
            />

            {/* Badge Panel */}
            <BadgeEditor
              badgeConfig={badgeConfig}
              onBadgeChange={handleBadgeChange}
            />

            {/* Export Panel */}
            <ExportPanel onExport={handleExport} />
          </div>

          {/* Storage Indicator */}
          <StorageIndicator />
        </aside>

        {/* Canvas Area */}
        <main className="flex-1 bg-[#1a1a1a] flex items-center justify-center p-8">
          <ThumbnailCanvas
            ref={canvasRef}
            format={format}
            imageUrl={uploadedImage}
            selectedTemplate={selectedTemplate}
            titleText={titleText}
            subtitleText={subtitleText}
            extraText={extraText}
            fontConfig={fontConfig}
            textColors={textColors}
            textPositions={textPositions}
            onTextPositionChange={handleTextPositionChange}
            badgeConfig={badgeConfig}
            filterConfig={filterConfig}
            layers={layers}
            onLayerUpdate={handleUpdateLayer}
          />
        </main>
      </div>

      {/* Footer */}
      <footer className="bg-[#2a2a2a] border-t border-gray-700 px-6 py-2 flex-shrink-0">
        <div className="flex items-center justify-center gap-3 text-xs text-gray-500">
          <a
            href="https://www.pix3ltools.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-pink-400 transition-colors"
          >
            From the <span className="text-pink-400">Pix3lTools</span> Collection
          </a>
          <span className="text-gray-600">•</span>
          <a
            href="https://x.com/pix3ltools"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-cyan-400 transition-colors"
            title="Follow on X"
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            <span>Follow</span>
          </a>
          <span className="text-gray-600">•</span>
          <a
            href="/privacy.html"
            className="hover:text-gray-300 transition-colors"
          >
            Privacy Policy
          </a>
        </div>
      </footer>
    </div>
  )
}

export default App
