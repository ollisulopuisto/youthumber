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
  getSpeaker,
  currentLayout,
  slotFrameFor,
  isSpeakerLayer,
  setSpeakerSource,
  setSpeakerProcessing,
  setSpeakerCutout,
  activeMaskUrl,
  updateSpeakerTransform,
  updateSpeakerMaskOptions,
  toggleSpeakerVisibility,
  clearSpeakerImage,
  renameSpeaker,
  setSpeakerCount,
  moveSpeaker,
  applyLayout,
  setBackgroundImage,
  updateBackground,
  updateTextLayer,
  updateDecor,
  reorderLayers,
} from './modules/thumbnail/thumbnailState'

import {
  saveProjectToStorage,
  loadProjectFromStorage,
  listStoredProjects,
} from './modules/thumbnail/thumbnailStorage'

import { defaultRemoverRegistry } from './services/background-removal'
import { compositeFromDataUrls } from './services/background-removal/composite'
import { autoFrameSpeaker } from './modules/thumbnail/autoFrame'

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
    return createDefaultProject('YouTube Thumbnail')
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

  /** Re-runs auto-frame for every speaker with a cutout, aiming at their slot in `next`. */
  const reframeSpeakers = async (next) => {
    for (const speaker of next.speakers) {
      if (!speaker.cutoutUrl) continue
      const frame = slotFrameFor(next, speaker.id)
      if (!frame) continue
      try {
        const transform = await autoFrameSpeaker(speaker.cutoutUrl, frame)
        if (transform) setProject((prev) => updateSpeakerTransform(prev, speaker.id, transform))
      } catch (err) {
        console.warn('Auto-frame failed:', err)
      }
    }
  }

  /** Applies a change that moves speakers between slots, then re-frames their cutouts. */
  const applyAndReframe = (change) => {
    const next = change(project)
    if (next === project) return
    setProject(next)
    reframeSpeakers(next)
  }

  const handleSelectLayout = (layout) => {
    applyAndReframe((prev) => applyLayout(prev, layout))
  }

  const handleApplyShowPreset = (showPreset) => {
    setProject((prev) => applyShowPresetToProject(prev, showPreset))
  }

  const handleSetSpeakerCount = (count) => {
    const dropped = project.speakers.slice(count).filter((s) => s.sourceImageUrl)
    if (dropped.length && !confirm(`Remove ${dropped.map((s) => s.name).join(', ')} and their photos?`)) {
      return
    }
    if (dropped.some((s) => s.id === selectedLayer)) setSelectedLayer(null)
    applyAndReframe((prev) => setSpeakerCount(prev, count))
  }

  const handleMoveSpeaker = (speakerId, delta) => {
    applyAndReframe((prev) => moveSpeaker(prev, speakerId, delta))
  }

  const handleRenameSpeaker = (speakerId, name) => {
    setProject((prev) => renameSpeaker(prev, speakerId, name))
  }

  const handleSaveProject = () => {
    saveProjectToStorage(project)
    alert(`Project "${project.name}" saved to local storage.`)
  }

  const handleExport = async ({ format = 'jpeg', quality = 0.95, resolution = 'hd' }) => {
    if (!canvasRef.current) return
    const safeName = project.name.trim().replace(/\s+/g, '-').toLowerCase()
    const scale = resolution === 'fullhd' ? 1.5 : 1
    const dims = resolution === 'fullhd' ? '1920x1080' : '1280x720'
    try {
      const result = await canvasRef.current.exportThumbnail({
        format,
        quality,
        scale,
        filename: `${safeName}-${dims}.${format === 'png' ? 'png' : 'jpg'}`,
      })
      if (result?.savedPath) alert(`Exported to ${result.savedPath}`)
    } catch (err) {
      alert(`Export failed: ${err.message}`)
    }
  }

  // Speaker Actions
  const handleUploadSpeakerSource = (slotId, sourceUrl) => {
    setProject((prev) => setSpeakerSource(prev, slotId, sourceUrl))
    setSelectedLayer(slotId)
  }

  const handleTriggerRemoveBackground = async (slotId) => {
    const speaker = getSpeaker(project, slotId)
    if (!speaker?.sourceImageUrl) return

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

      let cutoutUrl = await blobToDataUrl(result.image)
      const maskUrl = await blobToDataUrl(result.mask)
      const objectsMaskUrl = result.objectsMask ?? null
      if (speaker.maskOptions?.keepObjects && objectsMaskUrl) {
        cutoutUrl = await compositeFromDataUrls(speaker.sourceImageUrl, objectsMaskUrl, {
          feather: 0,
          threshold: 0,
          opacity: 1,
          invert: false,
          ...speaker.maskOptions,
        })
      }

      setProject((prev) =>
        setSpeakerCutout(
          prev,
          slotId,
          cutoutUrl,
          maskUrl,
          result.metadata?.backendId || activeRemover.id,
          objectsMaskUrl
        )
      )

      // Auto-frame using the Vision-generated cutout mask to find a nice spot
      handleAutoFrameSpeaker(slotId, cutoutUrl)
    } catch (err) {
      console.error('Background removal failed:', err)
      alert(`Background removal failed: ${err.message}`)
      setProject((prev) => setSpeakerProcessing(prev, slotId, false, 0, undefined, err.message))
    }
  }

  const handleAutoFrameSpeaker = async (slotId, cutoutUrlOverride) => {
    const cutoutUrl = cutoutUrlOverride || getSpeaker(project, slotId)?.cutoutUrl
    const frame = slotFrameFor(project, slotId)
    if (!cutoutUrl || !frame) return
    try {
      const transform = await autoFrameSpeaker(cutoutUrl, frame)
      if (transform) {
        setProject((prev) => updateSpeakerTransform(prev, slotId, transform))
      }
    } catch (err) {
      console.warn('Auto-frame failed:', err)
    }
  }

  const handleRemoveSpeaker = (slotId) => {
    setProject((prev) => clearSpeakerImage(prev, slotId))
  }

  const handleUpdateSpeakerTransform = useCallback((slotId, transform) => {
    setProject((prev) => updateSpeakerTransform(prev, slotId, transform))
  }, [])

  const handleResetSpeakerTransform = (slotId) => {
    const index = project.speakers.findIndex((s) => s.id === slotId)
    const slot = currentLayout(project).slots[index]
    if (!slot) return
    setProject((prev) => updateSpeakerTransform(prev, slotId, { ...slot.transform }))
  }

  const handleUpdateSpeakerMaskOptions = useCallback(
    async (slotId, newOptions) => {
      setProject((prev) => updateSpeakerMaskOptions(prev, slotId, newOptions))

      const currentSpeaker = getSpeaker(project, slotId)
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
            activeMaskUrl({ ...currentSpeaker, maskOptions: merged }),
            merged
          )
          setProject((prev) =>
            setSpeakerCutout(
              prev,
              slotId,
              newCutoutUrl,
              currentSpeaker.maskUrl,
              currentSpeaker.removerId
            )
          )
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
        gradient: null,
      },
    }))
  }

  const handleUpdateBackground = (updates) => {
    setProject((prev) => updateBackground(prev, updates))
  }

  // Text Actions
  const handleUpdateText = useCallback((updates) => {
    setProject((prev) => updateTextLayer(prev, updates))
  }, [])

  const handleUpdateDecor = useCallback((updates) => {
    setProject((prev) => updateDecor(prev, updates))
  }, [])

  // Layer Actions
  const handleReorderLayers = (newOrder) => {
    setProject((prev) => reorderLayers(prev, newOrder))
  }

  const handleToggleVisibility = (layerId) => {
    if (isSpeakerLayer(layerId)) {
      setProject((prev) => toggleSpeakerVisibility(prev, layerId))
    } else if (layerId === 'text') {
      setProject((prev) => updateTextLayer(prev, { visible: !prev.text.visible }))
    } else if (layerId === 'decor') {
      setProject((prev) => updateDecor(prev, { visible: !(prev.decor?.visible ?? true) }))
    }
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-gray-950 text-gray-100 overflow-hidden font-sans select-none">
      {/* 1. Header Toolbar */}
      <Toolbar
        project={project}
        onUpdateProjectName={handleUpdateProjectName}
        onSelectLayout={handleSelectLayout}
        onApplyShowPreset={handleApplyShowPreset}
        onOpenShows={() => setShowShowsModal(true)}
        onSaveProject={handleSaveProject}
        onOpenProjects={() => setShowProjectsModal(true)}
        onExport={handleExport}
        onSetSpeakerCount={handleSetSpeakerCount}
      />

      {/* Main Workspace Area */}
      {/* The canvas always gets at least half the window height; the panels below scroll
          rather than squeezing it (with 4 speaker cards it shrank to a sliver). */}
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
        {/* 2. Top / Canvas Area (Center 1280x720 Canvas) */}
        <div className="flex-1 flex items-center justify-center p-3 sm:p-4 min-h-[50vh] bg-gray-900/60 overflow-hidden">
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
        <div className="min-h-44 sm:min-h-52 bg-gray-950 px-4 py-2 border-t border-gray-800 grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0 items-start">
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
            onUpdateDecor={handleUpdateDecor}
            onUpdateSpeakerTransform={handleUpdateSpeakerTransform}
            onUpdateBackground={handleUpdateBackground}
            onResetSpeakerTransform={handleResetSpeakerTransform}
            onUpdateSpeakerMaskOptions={handleUpdateSpeakerMaskOptions}
          />
        </div>

        {/* 4. Bottom Dock: one card per speaker + background */}
        <div className="shrink-0">
          <SpeakerSlotsPanel
            project={project}
            onUploadSpeakerSource={handleUploadSpeakerSource}
            onTriggerRemoveBackground={handleTriggerRemoveBackground}
            onAutoFrameSpeaker={handleAutoFrameSpeaker}
            onRemoveSpeaker={handleRemoveSpeaker}
            onRenameSpeaker={handleRenameSpeaker}
            onMoveSpeaker={handleMoveSpeaker}
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
