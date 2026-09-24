import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { fabric } from 'fabric'
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  isSpeakerLayer,
} from '../../modules/thumbnail/thumbnailState'
import { saveExportedImage } from '../../services/exportImage'
import {
  gradientSpec,
  photoFilterValues,
  vignetteColorStops,
} from '../../modules/thumbnail/backgroundRender'
import { EffectText, applyTextColorEffects, effectsFromState } from '../../modules/thumbnail/effectText'
import { skewXToSlant } from '../../modules/thumbnail/textEffects'

const MAX_BACKGROUND_SIDE = 4096
// Fabric builds its WebGL filter backend at load time with a 2048px texture limit, so
// raising textureSize alone does nothing; rebuild the backend after raising it.
if (fabric.textureSize < MAX_BACKGROUND_SIDE) {
  fabric.textureSize = MAX_BACKGROUND_SIDE
  fabric.filterBackend = fabric.initFilterBackend()
}

const ThumbnailStudioCanvas = forwardRef(function ThumbnailStudioCanvas(
  {
    project,
    selectedLayer,
    onSelectLayer,
    onUpdateSpeakerTransform,
    onUpdateTextLayer,
    onCanvasReady,
  },
  ref
) {
  const fitRef = useRef(null)
  const backgroundImageRef = useRef(null) // { url, img, blur, brightness }
  const latestBackgroundRef = useRef(project.background)
  const containerRef = useRef(null)
  const canvasElRef = useRef(null)
  const fabricCanvasRef = useRef(null)
  const isUpdatingFromStateRef = useRef(false)

  // 1. Initialize Fabric.js Canvas fixed at 1280 x 720
  useEffect(() => {
    if (!canvasElRef.current) return

    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.dispose()
      fabricCanvasRef.current = null
    }

    const canvas = new fabric.Canvas(canvasElRef.current, {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      backgroundColor: project.background.color || '#111827',
      selection: true,
      preserveObjectStacking: true,
    })

    fabricCanvasRef.current = canvas

    // With preserveObjectStacking, Fabric gives every click to the topmost object under
    // the pointer, so a selected speaker partly covered by another couldn't be dragged.
    // Keep the selected layer while the click lands on it (or its handles).
    const findTopmostTarget = canvas.findTarget.bind(canvas)
    canvas.findTarget = (e, skipGroup) => {
      const active = canvas.getActiveObject()
      if (active && !skipGroup) {
        const pointer = canvas.getPointer(e, true)
        if (active._findTargetCorner(pointer) || canvas._searchPossibleTargets([active], pointer)) {
          return active
        }
      }
      return findTopmostTarget(e, skipGroup)
    }

    // Selection event listeners
    canvas.on('selection:created', (e) => {
      const activeObj = e.selected?.[0]
      if (activeObj?.data?.layerId) {
        onSelectLayer?.(activeObj.data.layerId)
      }
    })

    canvas.on('selection:updated', (e) => {
      const activeObj = e.selected?.[0]
      if (activeObj?.data?.layerId) {
        onSelectLayer?.(activeObj.data.layerId)
      }
    })

    canvas.on('selection:cleared', () => {
      onSelectLayer?.(null)
    })

    // Transform modification listeners
    canvas.on('object:modified', (e) => {
      if (isUpdatingFromStateRef.current) return
      const obj = e.target
      if (!obj || !obj.data?.layerId) return

      const layerId = obj.data.layerId

      if (isSpeakerLayer(layerId)) {
        onUpdateSpeakerTransform?.(layerId, {
          x: Math.round(obj.left || 0),
          y: Math.round(obj.top || 0),
          scaleX: Number((obj.scaleX || 1).toFixed(3)),
          scaleY: Number((obj.scaleY || 1).toFixed(3)),
          rotation: Math.round(obj.angle || 0),
          flipX: !!obj.flipX,
        })
      } else if (layerId === 'text') {
        onUpdateTextLayer?.({
          transform: {
            x: Math.round(obj.left || 0),
            y: Math.round(obj.top || 0),
            scaleX: Number((obj.scaleX || 1).toFixed(3)),
            scaleY: Number((obj.scaleY || 1).toFixed(3)),
            rotation: Math.round(obj.angle || 0),
          },
          slant: skewXToSlant(obj.skewX),
        })
      }
    })

    // Fit the 16:9 canvas inside the available box — both width and height. Sizing by
    // width alone cut off the top and bottom whenever the area was wide and short.
    const updateCanvasScale = () => {
      if (!fitRef.current || !containerRef.current || !fabricCanvasRef.current) return
      const box = fitRef.current
      const fitWidth = Math.min(
        CANVAS_WIDTH,
        box.clientWidth,
        (box.clientHeight || Infinity) * (CANVAS_WIDTH / CANVAS_HEIGHT)
      )
      containerRef.current.style.width = `${fitWidth}px`
      const scale = fitWidth / CANVAS_WIDTH
      const canvas = fabricCanvasRef.current
      canvas.setDimensions({
        width: CANVAS_WIDTH * scale,
        height: CANVAS_HEIGHT * scale,
      })
      canvas.setZoom(scale)
      canvas.renderAll()
    }

    const resizeObserver = new ResizeObserver(() => {
      updateCanvasScale()
    })

    if (fitRef.current) {
      resizeObserver.observe(fitRef.current)
    }

    updateCanvasScale()
    onCanvasReady?.()

    return () => {
      resizeObserver.disconnect()
      // The cached background photo belongs to this canvas; a remount (React StrictMode
      // mounts twice in dev) must load it again for the new one.
      backgroundImageRef.current = null
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose()
        fabricCanvasRef.current = null
      }
    }
  }, [])

  // 2. Sync Fabric objects with project state
  useEffect(() => {
    const canvas = fabricCanvasRef.current
    if (!canvas) return

    isUpdatingFromStateRef.current = true

    // Set background
    const bg = project.background
    latestBackgroundRef.current = bg
    if (bg.type === 'gradient' && bg.gradient) {
      canvas.setBackgroundColor(
        new fabric.Gradient(gradientSpec(bg.gradient, CANVAS_WIDTH, CANVAS_HEIGHT)),
        () => canvas.renderAll()
      )
      canvas.setBackgroundImage(null, () => canvas.renderAll())
    } else if (bg.type === 'solid' || !bg.imageUrl) {
      canvas.setBackgroundColor(bg.color || '#111827', () => canvas.renderAll())
      canvas.setBackgroundImage(null, () => canvas.renderAll())
    } else {
      syncBackgroundImage(canvas, bg)
    }
    syncVignette(canvas, bg.vignette || 0)

    // Helper to find existing object by layerId
    const findObj = (layerId) => canvas.getObjects().find((o) => o.data?.layerId === layerId)

    // Drop canvas objects for speakers that no longer exist (speaker count went down)
    const speakerIds = new Set(project.speakers.map((s) => s.id))
    canvas
      .getObjects()
      .filter((o) => o.data?.layerId && isSpeakerLayer(o.data.layerId) && !speakerIds.has(o.data.layerId))
      .forEach((o) => canvas.remove(o))

    for (const speaker of project.speakers) {
      syncSpeakerObject(canvas, speaker, speaker.id)
    }

    // Sync Text layer
    syncTextObject(canvas, project.text)

    // Reorder layers according to project.layerOrder
    reorderCanvasObjects(canvas, project.layerOrder)
    const vignette = canvas.getObjects().find((o) => o.data?.role === 'vignette')
    if (vignette) canvas.sendToBack(vignette)

    // Handle active selection sync
    if (selectedLayer) {
      const targetObj = findObj(selectedLayer)
      if (targetObj && canvas.getActiveObject() !== targetObj) {
        canvas.setActiveObject(targetObj)
      }
    }

    canvas.renderAll()
    isUpdatingFromStateRef.current = false
  }, [project, selectedLayer])

  // Background photo: loaded once per URL, filters re-applied only when blur/darken change
  // (re-loading a full-HD photo and re-blurring it on every edit made sliders crawl).
  const syncBackgroundImage = (canvasAtCall, bg) => {
    const cached = backgroundImageRef.current
    const applyFilters = (entry) => {
      // Photos load asynchronously; draw on whichever canvas is live by then.
      const canvas = fabricCanvasRef.current ?? canvasAtCall
      const { blur, brightness } = photoFilterValues(latestBackgroundRef.current)
      if (entry.blur === blur && entry.brightness === brightness && canvas.backgroundImage === entry.img) {
        return
      }
      entry.img.filters = [
        blur > 0 && new fabric.Image.filters.Blur({ blur }),
        brightness !== 0 && new fabric.Image.filters.Brightness({ brightness }),
      ].filter(Boolean)
      entry.img.applyFilters()
      entry.blur = blur
      entry.brightness = brightness
      canvas.setBackgroundImage(entry.img, () => canvas.renderAll())
    }

    if (cached?.url === bg.imageUrl) {
      if (cached.img) applyFilters(cached)
      return
    }

    const entry = { url: bg.imageUrl, img: null, blur: null, brightness: null }
    backgroundImageRef.current = entry
    fabric.Image.fromURL(
      bg.imageUrl,
      (loaded) => {
        if (!fabricCanvasRef.current || backgroundImageRef.current !== entry) return
        // WebGL filters fail on textures larger than fabric.textureSize; shrink huge photos.
        let img = loaded
        const longest = Math.max(loaded.width || 1, loaded.height || 1)
        if (longest > MAX_BACKGROUND_SIDE) {
          const shrink = MAX_BACKGROUND_SIDE / longest
          const el = document.createElement('canvas')
          el.width = Math.round(loaded.width * shrink)
          el.height = Math.round(loaded.height * shrink)
          el.getContext('2d').drawImage(loaded.getElement(), 0, 0, el.width, el.height)
          img = new fabric.Image(el)
        }
        const scale = Math.max(CANVAS_WIDTH / (img.width || 1), CANVAS_HEIGHT / (img.height || 1))
        img.set({
          originX: 'center',
          originY: 'center',
          left: CANVAS_WIDTH / 2,
          top: CANVAS_HEIGHT / 2,
          scaleX: scale,
          scaleY: scale,
          selectable: false,
          evented: false,
        })
        entry.img = img
        applyFilters(entry)
      },
      { crossOrigin: 'anonymous' }
    )
  }

  // Vignette: a click-through radial overlay just above the background, below everything else.
  const syncVignette = (canvas, strength) => {
    let vignette = canvas.getObjects().find((o) => o.data?.role === 'vignette')
    if (!strength) {
      if (vignette) canvas.remove(vignette)
      return
    }
    if (!vignette) {
      vignette = new fabric.Rect({
        left: 0,
        top: 0,
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        selectable: false,
        evented: false,
        data: { role: 'vignette' },
      })
      canvas.add(vignette)
    }
    vignette.set({
      fill: new fabric.Gradient({
        ...gradientSpec({ colors: ['#000', '#000'], type: 'radial' }, CANVAS_WIDTH, CANVAS_HEIGHT),
        colorStops: vignetteColorStops(strength),
      }),
    })
  }

  // Helper function to sync a speaker object
  const syncSpeakerObject = (canvas, speakerState, layerId) => {
    const existing = canvas.getObjects().find((o) => o.data?.layerId === layerId)
    const imageSrc = speakerState.cutoutUrl || speakerState.sourceImageUrl

    if (!speakerState.visible || !imageSrc) {
      if (existing) {
        canvas.remove(existing)
      }
      return
    }

    if (existing && existing.data?.currentSrc === imageSrc) {
      // Just update transform
      existing.set({
        left: speakerState.transform.x,
        top: speakerState.transform.y,
        scaleX: speakerState.transform.scaleX,
        scaleY: speakerState.transform.scaleY,
        angle: speakerState.transform.rotation,
        flipX: !!speakerState.transform.flipX,
        visible: speakerState.visible,
      })
      existing.setCoords()
    } else {
      if (existing) {
        canvas.remove(existing)
      }
      fabric.Image.fromURL(
        imageSrc,
        (img) => {
          if (!fabricCanvasRef.current) return
          img.set({
            data: { layerId, currentSrc: imageSrc },
            left: speakerState.transform.x,
            top: speakerState.transform.y,
            scaleX: speakerState.transform.scaleX,
            scaleY: speakerState.transform.scaleY,
            angle: speakerState.transform.rotation,
            flipX: !!speakerState.transform.flipX,
            originX: 'center',
            originY: 'center',
            // Clicks on a cutout's transparent area reach whatever is visible below it.
            perPixelTargetFind: true,
            targetFindTolerance: 6,
            cornerColor: '#38BDF8',
            cornerSize: 12,
            transparentCorners: false,
            borderColor: '#0284C7',
            borderScaleFactor: 2,
            hasRotatingPoint: true,
          })
          canvas.add(img)
          reorderCanvasObjects(canvas, project.layerOrder)
          canvas.renderAll()
        },
        { crossOrigin: 'anonymous' }
      )
    }
  }

  // Helper function to sync text object
  const syncTextObject = (canvas, textState) => {
    let existing = canvas.getObjects().find((o) => o.data?.layerId === 'text')

    if (!textState.visible) {
      if (existing) canvas.remove(existing)
      return
    }

    const shadow = textState.shadowColor
      ? new fabric.Shadow({
          color: textState.shadowColor,
          blur: textState.shadowBlur || 10,
          offsetX: textState.shadowOffsetX || 3,
          offsetY: textState.shadowOffsetY || 5,
        })
      : null

    if (existing) {
      existing.set({
        text: textState.text || ' ',
        fontFamily: textState.fontFamily || 'Montserrat',
        fontSize: textState.fontSize || 64,
        fontWeight: textState.fontWeight || 'bold',
        fontStyle: textState.fontStyle || 'normal',
        textAlign: textState.textAlign || 'center',
        stroke: textState.strokeColor || '#000000',
        strokeWidth: textState.strokeWidth || 0,
        shadow: shadow,
        effects: effectsFromState(textState),
        left: textState.transform.x,
        top: textState.transform.y,
        scaleX: textState.transform.scaleX,
        scaleY: textState.transform.scaleY,
        angle: textState.transform.rotation,
        originX: 'center',
        originY: 'center',
      })
      applyTextColorEffects(existing, textState)
      existing.setCoords()
    } else {
      const textObj = new EffectText(textState.text || 'EPISODE TITLE', {
        data: { layerId: 'text' },
        left: textState.transform.x,
        top: textState.transform.y,
        fontFamily: textState.fontFamily || 'Montserrat',
        fontSize: textState.fontSize || 64,
        fontWeight: textState.fontWeight || 'bold',
        fontStyle: textState.fontStyle || 'normal',
        textAlign: textState.textAlign || 'center',
        stroke: textState.strokeColor || '#000000',
        strokeWidth: textState.strokeWidth || 0,
        shadow: shadow,
        effects: effectsFromState(textState),
        scaleX: textState.transform.scaleX,
        scaleY: textState.transform.scaleY,
        angle: textState.transform.rotation,
        originX: 'center',
        originY: 'center',
        cornerColor: '#F59E0B',
        cornerSize: 12,
        transparentCorners: false,
        borderColor: '#D97706',
      })
      applyTextColorEffects(textObj, textState)

      // Update text in project state on inline edit
      textObj.on('changed', () => {
        onUpdateTextLayer?.({ text: textObj.text })
      })

      canvas.add(textObj)
      reorderCanvasObjects(canvas, project.layerOrder)
    }

    // Web fonts load on demand. Until one has, Fabric measures and draws the fallback
    // and caches that, so a newly picked font didn't show until some other redraw.
    const family = textState.fontFamily || 'Montserrat'
    const fontSpec = `${textState.fontWeight || 'bold'} 64px "${family}"`
    if (document.fonts && !document.fonts.check(fontSpec)) {
      document.fonts.load(fontSpec).then(() => {
        const textObj = fabricCanvasRef.current?.getObjects().find((o) => o.data?.layerId === 'text')
        if (!textObj || textObj.fontFamily !== family) return
        fabric.util.clearFabricFontCache(family)
        textObj.initDimensions()
        applyTextColorEffects(textObj, textState)
        textObj.setCoords()
        textObj.dirty = true
        fabricCanvasRef.current.requestRenderAll()
      })
    }
  }

  // Reorder Fabric canvas objects based on layerOrder array
  const reorderCanvasObjects = (canvas, layerOrder) => {
    const objects = canvas.getObjects()
    layerOrder.forEach((layerId, targetIndex) => {
      const obj = objects.find((o) => o.data?.layerId === layerId)
      if (obj) {
        canvas.moveTo(obj, targetIndex)
      }
    })
  }

  // Expose imperative API for exact 1280x720 export
  useImperativeHandle(ref, () => ({
    getCanvas: () => fabricCanvasRef.current,
    exportThumbnail: ({ format = 'jpeg', quality = 0.92, filename, scale = 1 }) => {
      const canvas = fabricCanvasRef.current
      if (!canvas) return null

      // Deselect before export
      canvas.discardActiveObject()
      canvas.renderAll()

      // Calculate multiplier so the export is exactly 1280x720 * scale
      const currentZoom = canvas.getZoom()
      const multiplier = (1 / currentZoom) * scale

      const dataUrl = canvas.toDataURL({
        format: format === 'png' ? 'png' : 'jpeg',
        quality: format === 'png' ? 1.0 : quality,
        multiplier: multiplier,
      })

      const name =
        filename ||
        `youtube-thumbnail-1280x720-${new Date().toISOString().slice(0, 10)}.${
          format === 'png' ? 'png' : 'jpg'
        }`
      return saveExportedImage(dataUrl, name)
    },
  }))

  return (
    <div className="w-full h-full min-h-0 flex items-center justify-center p-2 sm:p-4 bg-gray-950/80 rounded-xl border border-gray-800 shadow-2xl">
      <div ref={fitRef} className="w-full h-full min-h-0 flex items-center justify-center">
        <div
          ref={containerRef}
          className="aspect-[16/9] relative overflow-hidden rounded-lg shadow-inner bg-black flex items-center justify-center"
        >
          <canvas ref={canvasElRef} />
        </div>
      </div>
    </div>
  )
})

export default ThumbnailStudioCanvas
