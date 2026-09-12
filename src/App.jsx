import { useState, useRef, useEffect, useCallback } from 'react'
import Toolbar from './components/ThumbnailEditor/Toolbar'
import ThumbnailStudioCanvas from './components/ThumbnailEditor/ThumbnailStudioCanvas'
import LayersPanel from './components/ThumbnailEditor/LayersPanel'
import PropertiesPanel from './components/ThumbnailEditor/PropertiesPanel'
import SpeakerSlotsPanel from './components/ThumbnailEditor/SpeakerSlotsPanel'
import ProjectGalleryModal from './components/ThumbnailEditor/ProjectGalleryModal'
import ShowPresetModal from './components/ThumbnailEditor/ShowPresetModal'
import { applyShowPresetToProject } from './modules/shows/showPreferences'

import {
  createDefaultProject,
  setSpeakerSource,
  setSpeakerProcessing,
  setSpeakerCutout,
  updateSpeakerTransform,
  updateSpeakerMaskOptions,
  toggleSpeakerVisibility,
  removeSpeaker,
  setBackgroundImage,
  setBackgroundColor,
  updateTextLayer,
  reorderLayers,
  applyTemplateToProject,
} from './modules/thumbnail/thumbnailState'

import {
  saveProjectToStorage,
  loadProjectFromStorage,
  listStoredProjects,
} from './modules/thumbnail/thumbnailStorage'

import { defaultRemoverRegistry } from './services/background-removal'
import { compositeFromDataUrls } from './services/background-removal/composite'

const blobToDataUrl = async (source) => {
  if (typeof source === 'string') return source
  if (source instanceof Blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(source)
    })
  }
  return source
}

function App() {
  const [project, setProject] = useState(() => {
    // Try restoring last modified project or create default
    const existing = listStoredProjects()
    if (existing.length > 0) {
      const loaded = loadProjectFromStorage(existing[0].id)
      if (loaded) return loaded
    }
    return createDefaultProject('YouTube Dual Speaker Thumbnail')
  })

  const [selectedLayer, setSelectedLayer] = useState('text')
  const [showProjectsModal, setShowProjectsModal] = useState(false)
  const [showShowsModal, setShowShowsModal] = useState(false)
  const canvasRef = useRef(null)

  // Auto-save project changes to local storage
  useEffect(() => {
    const timer = setTimeout(() => {
      saveProjectToStorage(project)
    }, 600)
    return () => clearTimeout(timer)
  }, [project])

  // Handlers for Project & Templates
  const handleUpdateProjectName = (name) => {
    setProject((prev) => ({ ...prev, name, updatedAt: new Date().toISOString() }))
  }

  const handleSelectTemplate = (template) => {
    setProject((prev) => applyTemplateToProject(prev, template))
  }

  const handleApplyShowPreset = (showPreset) => {
    setProject((prev) => applyShowPresetToProject(prev, showPreset))
  }

  const handleToggleSpeakerCount = () => {
    setProject((prev) => {
      const isSingle = !prev.speaker2.visible
      if (isSingle) {
        // Switch to 2 speakers
        return {
          ...prev,
          speaker1: {
            ...prev.speaker1,
            visible: true,
            transform: { ...prev.speaker1.transform, x: 350, y: 420, scaleX: 0.9, scaleY: 0.9 },
          },
          speaker2: {
            ...prev.speaker2,
            visible: true,
            transform: { ...prev.speaker2.transform, x: 930, y: 420, scaleX: 0.9, scaleY: 0.9 },
          },
        }
      } else {
        // Switch to 1 speaker
        return {
          ...prev,
          speaker1: {
            ...prev.speaker1,
            visible: true,
            transform: { ...prev.speaker1.transform, x: 640, y: 430, scaleX: 1.05, scaleY: 1.05 },
          },
          speaker2: {
            ...prev.speaker2,
            visible: false,
          },
        }
      }
    })
  }

  const handleSaveProject = () => {
    saveProjectToStorage(project)
    alert(`Project "${project.name}" saved to local storage.`)
  }

  const handleExport = ({ format = 'jpeg', quality = 0.95 }) => {
    if (!canvasRef.current) return
    const safeName = project.name.trim().replace(/\s+/g, '-').toLowerCase()
    canvasRef.current.exportThumbnail({
      format,
      quality,
      filename: `${safeName}-1280x720.${format === 'png' ? 'png' : 'jpg'}`,
    })
  }

  // Speaker Actions
  const handleUploadSpeakerSource = (slotId, sourceUrl) => {
    setProject((prev) => setSpeakerSource(prev, slotId, sourceUrl))
    setSelectedLayer(slotId)
  }

  const handleTriggerRemoveBackground = async (slotId) => {
    const speaker = project[slotId]
    if (!speaker.sourceImageUrl) return

    setProject((prev) =>
      setSpeakerProcessing(prev, slotId, true, 5, 'Initializing background remover...')
    )

    try {
      const activeRemover = defaultRemoverRegistry.getActive()
      const result = await activeRemover.remove(speaker.sourceImageUrl, {
        onProgress: (pct, stage) => {
          setProject((prev) => setSpeakerProcessing(prev, slotId, true, pct, stage))
        },
      })

      const cutoutUrl = await blobToDataUrl(result.image)
      const maskUrl = await blobToDataUrl(result.mask)

      setProject((prev) =>
        setSpeakerCutout(
          prev,
          slotId,
          cutoutUrl,
          maskUrl,
          result.metadata?.backendId || activeRemover.id
        )
      )
    } catch (err) {
      console.error('Background removal failed:', err)
      alert(`Background removal failed: ${err.message}`)
      setProject((prev) => setSpeakerProcessing(prev, slotId, false, 0, undefined, err.message))
    }
  }

  const handleRemoveSpeaker = (slotId) => {
    setProject((prev) => removeSpeaker(prev, slotId))
    if (selectedLayer === slotId) setSelectedLayer(null)
  }

  const handleUpdateSpeakerTransform = useCallback((slotId, transform) => {
    setProject((prev) => updateSpeakerTransform(prev, slotId, transform))
  }, [])

  const handleResetSpeakerTransform = (slotId) => {
    const defaultX = slotId === 'speaker1' ? 350 : 930
    setProject((prev) =>
      updateSpeakerTransform(prev, slotId, {
        x: defaultX,
        y: 420,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        flipX: false,
      })
    )
  }

  const handleUpdateSpeakerMaskOptions = useCallback(
    async (slotId, newOptions) => {
      setProject((prev) => updateSpeakerMaskOptions(prev, slotId, newOptions))

      const currentSpeaker = project[slotId]
      if (currentSpeaker?.sourceImageUrl && currentSpeaker?.maskUrl) {
        const merged = {
          feather: 0,
          threshold: 0,
          opacity: 1,
          invert: false,
          ...(currentSpeaker.maskOptions || {}),
          ...newOptions,
        }
        try {
          const newCutoutUrl = await compositeFromDataUrls(
            currentSpeaker.sourceImageUrl,
            currentSpeaker.maskUrl,
            merged
          )
          setProject((prev) => ({
            ...prev,
            updatedAt: new Date().toISOString(),
            [slotId]: {
              ...prev[slotId],
              cutoutUrl: newCutoutUrl,
            },
          }))
        } catch (err) {
          console.warn('Live mask recompositing error:', err)
        }
      }
    },
    [project]
  )

  // Background Actions
  const handleUploadBackgroundImage = (imageUrl) => {
    setProject((prev) => setBackgroundImage(prev, imageUrl))
    setSelectedLayer('background')
  }

  const handleClearBackgroundImage = () => {
    setProject((prev) => ({
      ...prev,
      updatedAt: new Date().toISOString(),
      background: {
        ...prev.background,
        type: 'solid',
        imageUrl: null,
      },
    }))
  }

  const handleUpdateBackground = (updates) => {
    if (updates.color) {
      setProject((prev) => setBackgroundColor(prev, updates.color))
    }
  }

  // Text Actions
  const handleUpdateText = useCallback((updates) => {
    setProject((prev) => updateTextLayer(prev, updates))
  }, [])

  // Layer Actions
  const handleReorderLayers = (newOrder) => {
    setProject((prev) => reorderLayers(prev, newOrder))
  }

  const handleToggleVisibility = (layerId) => {
    if (layerId === 'speaker1' || layerId === 'speaker2') {
      setProject((prev) => toggleSpeakerVisibility(prev, layerId))
    } else if (layerId === 'text') {
      setProject((prev) => updateTextLayer(prev, { visible: !prev.text.visible }))
    }
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-gray-950 text-gray-100 overflow-hidden font-sans select-none">
      {/* 1. Header Toolbar */}
      <Toolbar
        project={project}
        onUpdateProjectName={handleUpdateProjectName}
        onSelectTemplate={handleSelectTemplate}
        onApplyShowPreset={handleApplyShowPreset}
        onOpenShows={() => setShowShowsModal(true)}
        onSaveProject={handleSaveProject}
        onOpenProjects={() => setShowProjectsModal(true)}
        onExport={handleExport}
        onToggleSpeakerCount={handleToggleSpeakerCount}
      />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* 2. Top / Canvas Area (Center 1280x720 Canvas) */}
        <div className="flex-1 flex items-center justify-center p-3 sm:p-4 min-h-0 bg-gray-900/60 overflow-hidden">
          <div className="w-full max-w-5xl h-full flex items-center justify-center">
            <ThumbnailStudioCanvas
              ref={canvasRef}
              project={project}
              selectedLayer={selectedLayer}
              onSelectLayer={setSelectedLayer}
              onUpdateSpeakerTransform={handleUpdateSpeakerTransform}
              onUpdateTextLayer={handleUpdateText}
            />
          </div>
        </div>

        {/* 3. Middle Section: Layers and Properties */}
        <div className="h-44 sm:h-52 bg-gray-950 px-4 py-2 border-t border-gray-800 grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0 overflow-y-auto">
          {/* Layers Panel */}
          <LayersPanel
            project={project}
            selectedLayer={selectedLayer}
            onSelectLayer={setSelectedLayer}
            onReorderLayers={handleReorderLayers}
            onToggleVisibility={handleToggleVisibility}
          />

          {/* Properties Panel */}
          <PropertiesPanel
            selectedLayer={selectedLayer}
            project={project}
            onUpdateText={handleUpdateText}
            onUpdateSpeakerTransform={handleUpdateSpeakerTransform}
            onUpdateBackground={handleUpdateBackground}
            onResetSpeakerTransform={handleResetSpeakerTransform}
            onUpdateSpeakerMaskOptions={handleUpdateSpeakerMaskOptions}
          />
        </div>

        {/* 4. Bottom Dock: Assets / Speaker 1 / Speaker 2 / Background */}
        <div className="shrink-0">
          <SpeakerSlotsPanel
            project={project}
            onUploadSpeakerSource={handleUploadSpeakerSource}
            onTriggerRemoveBackground={handleTriggerRemoveBackground}
            onRemoveSpeaker={handleRemoveSpeaker}
            onUploadBackgroundImage={handleUploadBackgroundImage}
            onClearBackgroundImage={handleClearBackgroundImage}
          />
        </div>
      </div>

      {/* Project Manager Modal */}
      {showProjectsModal && (
        <ProjectGalleryModal
          currentProjectId={project.id}
          onLoadProject={(loaded) => setProject(loaded)}
          onClose={() => setShowProjectsModal(false)}
        />
      )}

      {/* Show Preset Preferences Modal */}
      {showShowsModal && (
        <ShowPresetModal
          currentProject={project}
          onApplyShow={handleApplyShowPreset}
          onClose={() => setShowShowsModal(false)}
        />
      )}
    </div>
  )
}

export default App
