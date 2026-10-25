import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { fabric } from 'fabric'
import {
  isSpeakerLayer,
  isStickerLayer,
  isTextLayer,
  isExtraTextLayer,
  isBugLayer,
} from '../../modules/thumbnail/thumbnailState'
import { ElementObject, elementObjectProps } from '../../modules/thumbnail/elementObject'
import { saveExportedImage } from '../../services/exportImage'
import {
  gradientSpec,
  photoFilterValues,
  vignetteColorStops,
} from '../../modules/thumbnail/backgroundRender'
import { EffectText, applyTextColorEffects, effectsFromState } from '../../modules/thumbnail/effectText'
import { skewXToSlant } from '../../modules/thumbnail/textEffects'
import { DECOR_LAYER_ID, withDecorLayer } from '../../modules/thumbnail/decor'
import { DecorLayer } from '../../modules/thumbnail/decorObject'
import { installAlphaHitTest } from '../../modules/thumbnail/alphaHitTest'
import { intersectRect } from '../../modules/thumbnail/floatingPosition'

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
    onUpdateSticker,
    onUpdateBug,
    onCanvasReady,
    onSelectionRectChange,
    onContextMenu,
  },
  ref
) {
  const fitRef = useRef(null)
  const backgroundImageRef = useRef(null) // { url, img, blur, brightness }
  const backgroundFillKeyRef = useRef(null)
  const latestBackgroundRef = useRef(project.background)
  const containerRef = useRef(null)
  const canvasElRef = useRef(null)
  const fabricCanvasRef = useRef(null)
  const isUpdatingFromStateRef = useRef(false)
  const latestProjectRef = useRef(project)
  latestProjectRef.current = project
  // Read from Fabric's listeners, which are set up once per canvas.
  const callbacksRef = useRef({})
  callbacksRef.current = { onSelectionRectChange, onContextMenu }
  const reportSelectionRef = useRef(() => {})
  const canvasWidth = project.canvas?.width || 1280
  const canvasHeight = project.canvas?.height || 720
  const aspectRatio = canvasWidth / canvasHeight

  // 1. Initialize Fabric.js Canvas in the project's selected aspect ratio.
  useEffect(() => {
    if (!canvasElRef.current) return

    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.dispose()
      fabricCanvasRef.current = null
    }

    const canvas = new fabric.Canvas(canvasElRef.current, {
      width: canvasWidth,
      height: canvasHeight,
      backgroundColor: project.background.color || '#111827',
      selection: true,
      preserveObjectStacking: true,
    })

    fabricCanvasRef.current = canvas
    installAlphaHitTest(canvas)

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

    // Where the selected object is on screen, for the selection bar: its bounding box in
    // window pixels, cut to the canvas. Null while nothing is selected or it's being dragged.
    let dragging = false
    let lastRect = null
    const sendRect = (rect) => {
      const key = rect && `${rect.left},${rect.top},${rect.width},${rect.height}`
      if (key === lastRect) return
      lastRect = key
      callbacksRef.current.onSelectionRectChange?.(rect)
    }
    const reportSelection = () => {
      const active = canvas.getActiveObject()
      if (!active || dragging || !canvas.upperCanvasEl) return sendRect(null)
      const box = active.getBoundingRect(false, true)
      const el = canvas.upperCanvasEl.getBoundingClientRect()
      const rect = intersectRect(
        { left: el.left + box.left, top: el.top + box.top, width: box.width, height: box.height },
        { left: el.left, top: el.top, width: el.width, height: el.height }
      )
      sendRect(rect && {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      })
    }
    reportSelectionRef.current = reportSelection
    const hideSelection = () => sendRect(null)
    const startDrag = () => {
      dragging = true
      hideSelection()
    }

    // Selection event listeners
    canvas.on('selection:created', (e) => {
      const activeObj = e.selected?.[0]
      if (activeObj?.data?.layerId) {
        onSelectLayer?.(activeObj.data.layerId)
      }
      reportSelection()
    })

    canvas.on('selection:updated', (e) => {
      const activeObj = e.selected?.[0]
      if (activeObj?.data?.layerId) {
        onSelectLayer?.(activeObj.data.layerId)
      }
      reportSelection()
    })

    canvas.on('selection:cleared', () => {
      // Not when the editor itself moved the selection off the canvas (see the sync below).
      if (!isUpdatingFromStateRef.current) onSelectLayer?.(null)
      hideSelection()
    })

    canvas.on('mouse:down', hideSelection)
    canvas.on('object:moving', startDrag)
    canvas.on('object:scaling', startDrag)
    canvas.on('object:rotating', startDrag)
    canvas.on('mouse:up', () => {
      dragging = false
      reportSelection()
    })
    canvas.on('object:modified', reportSelection)

    // Right-click: select what's under the pointer and open the editor's menu for it,
    // instead of the browser's (or WebKit's) own.
    const handleContextMenu = (e) => {
      e.preventDefault()
      const target = canvas.findTarget(e, false)
      const layerId = target?.data?.layerId
      if (!layerId || !target.selectable) return
      if (canvas.getActiveObject() !== target) {
        canvas.setActiveObject(target)
        canvas.requestRenderAll()
      }
      callbacksRef.current.onContextMenu?.({ layerId, x: e.clientX, y: e.clientY })
    }
    const upperCanvasEl = canvas.upperCanvasEl
    upperCanvasEl.addEventListener('contextmenu', handleContextMenu)

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
      } else if (isStickerLayer(layerId)) {
        // Resizing changes the element's size, not its scale, so its lines stay even.
        onUpdateSticker?.(layerId, {
          x: Math.round(obj.left || 0),
          y: Math.round(obj.top || 0),
          width: Math.round((obj.width || 1) * (obj.scaleX || 1)),
          height: Math.round((obj.height || 1) * (obj.scaleY || 1)),
          rotation: Math.round(obj.angle || 0),
          flipX: !!obj.flipX,
        })
      } else if (isBugLayer(layerId)) {
        // Like elements: resizing changes the size, and the image is re-scaled from it.
        onUpdateBug?.(layerId, {
          x: Math.round(obj.left || 0),
          y: Math.round(obj.top || 0),
          width: Math.round(obj.getScaledWidth()),
          height: Math.round(obj.getScaledHeight()),
          rotation: Math.round(obj.angle || 0),
          flipX: !!obj.flipX,
        })
      } else if (isTextLayer(layerId)) {
        onUpdateTextLayer?.(
          {
            transform: {
              x: Math.round(obj.left || 0),
              y: Math.round(obj.top || 0),
              scaleX: Number((obj.scaleX || 1).toFixed(3)),
              scaleY: Number((obj.scaleY || 1).toFixed(3)),
              rotation: Math.round(obj.angle || 0),
            },
            slant: skewXToSlant(obj.skewX),
          },
          layerId
        )
      }
    })

    // Fit the 16:9 canvas inside the available box — both width and height. Sizing by
    // width alone cut off the top and bottom whenever the area was wide and short.
    const updateCanvasScale = () => {
      if (!fitRef.current || !containerRef.current || !fabricCanvasRef.current) return
      const box = fitRef.current
      const fitWidth = Math.min(
        canvasWidth,
        box.clientWidth,
        (box.clientHeight || Infinity) * aspectRatio
      )
      containerRef.current.style.width = `${fitWidth}px`
      const scale = fitWidth / canvasWidth
      const canvas = fabricCanvasRef.current
      canvas.setDimensions({
        width: canvasWidth * scale,
        height: canvasHeight * scale,
      })
      canvas.setZoom(scale)
      canvas.requestRenderAll()
      reportSelection()
    }

    let resizeFrame = 0
    const resizeObserver = new ResizeObserver(() => {
      cancelAnimationFrame(resizeFrame)
      resizeFrame = requestAnimationFrame(updateCanvasScale)
    })

    if (fitRef.current) {
      resizeObserver.observe(fitRef.current)
    }

    updateCanvasScale()
    onCanvasReady?.()

    // The editor scrolls; the bar follows the object.
    window.addEventListener('scroll', reportSelection, true)
    window.addEventListener('resize', reportSelection)

    return () => {
      window.removeEventListener('scroll', reportSelection, true)
      window.removeEventListener('resize', reportSelection)
      upperCanvasEl.removeEventListener('contextmenu', handleContextMenu)
      reportSelectionRef.current = () => {}
      callbacksRef.current.onSelectionRectChange?.(null)
      resizeObserver.disconnect()
      cancelAnimationFrame(resizeFrame)
      // The cached background photo belongs to this canvas; a remount (React StrictMode
      // mounts twice in dev) must load it again for the new one.
      backgroundImageRef.current = null
      backgroundFillKeyRef.current = null
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose()
        fabricCanvasRef.current = null
      }
    }
  }, [canvasWidth, canvasHeight])

  // 2. Sync Fabric objects with project state
  useEffect(() => {
    const canvas = fabricCanvasRef.current
    if (!canvas) return

    isUpdatingFromStateRef.current = true

    // Set background
    const bg = project.background
    latestBackgroundRef.current = bg
    // Gradient/solid fills are rebuilt only when they change, not on every unrelated edit.
    const fillKey = bg.type === 'gradient' && bg.gradient
      ? `g:${JSON.stringify(bg.gradient)}`
      : bg.type === 'solid' || !bg.imageUrl
        ? `s:${bg.color || '#111827'}`
        : null
    if (fillKey) {
      if (backgroundFillKeyRef.current !== fillKey || canvas.backgroundImage) {
        if (bg.type === 'gradient' && bg.gradient) {
          canvas.setBackgroundColor(new fabric.Gradient(gradientSpec(bg.gradient, canvasWidth, canvasHeight)))
        } else {
          canvas.setBackgroundColor(bg.color || '#111827')
        }
        canvas.setBackgroundImage(null)
        backgroundFillKeyRef.current = fillKey
      }
    } else {
      backgroundFillKeyRef.current = null
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
    syncTextObject(canvas, project.text, 'text')
    const extraTexts = project.textLayers ?? []
    const extraTextIds = new Set(extraTexts.map((t) => t.id))
    canvas
      .getObjects()
      .filter((o) => o.data?.layerId && isExtraTextLayer(o.data.layerId) && !extraTextIds.has(o.data.layerId))
      .forEach((o) => canvas.remove(o))
    for (const extra of extraTexts) syncTextObject(canvas, extra, extra.id)
    syncBugObjects(canvas, project.bugs ?? [])
    syncDecorObject(canvas, project.decor)
    syncStickerObjects(canvas, project.stickers ?? [])

    // Reorder layers according to project.layerOrder
    reorderCanvasObjects(canvas, project.layerOrder)
    const vignette = canvas.getObjects().find((o) => o.data?.role === 'vignette')
    if (vignette) canvas.sendToBack(vignette)

    // Handle active selection sync. Deselecting (Esc), or picking a layer with nothing to
    // grab on the canvas (the background), drops the canvas selection too.
    const targetObj = selectedLayer && findObj(selectedLayer)
    if (targetObj?.selectable) {
      if (canvas.getActiveObject() !== targetObj) canvas.setActiveObject(targetObj)
    } else if (canvas.getActiveObject()) {
      canvas.discardActiveObject()
    }

    canvas.requestRenderAll()
    isUpdatingFromStateRef.current = false
    // Edits from the panel, the keys or undo move the object without a Fabric event.
    reportSelectionRef.current()
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
      const replaced = canvas.backgroundImage
      canvas.setBackgroundImage(entry.img, () => canvas.requestRenderAll())
      // A filtered photo holds a full-size WebGL texture and two canvases until disposed.
      if (replaced && replaced !== entry.img && replaced instanceof fabric.Image) replaced.dispose()
    }

    if (cached?.url === bg.imageUrl) {
      if (cached.img) applyFilters(cached)
      return
    }

    // A photo replaced while off screen (e.g. under a gradient) is never swapped out below.
    if (cached?.img && canvasAtCall.backgroundImage !== cached.img) cached.img.dispose()
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
        const scale = Math.max(canvasWidth / (img.width || 1), canvasHeight / (img.height || 1))
        img.set({
          originX: 'center',
          originY: 'center',
          left: canvasWidth / 2,
          top: canvasHeight / 2,
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
        width: canvasWidth,
        height: canvasHeight,
        selectable: false,
        evented: false,
        data: { role: 'vignette' },
      })
      canvas.add(vignette)
    }
    vignette.set({
      fill: new fabric.Gradient({
        ...gradientSpec({ colors: ['#000', '#000'], type: 'radial' }, canvasWidth, canvasHeight),
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
          const live = fabricCanvasRef.current
          if (!live || live !== canvas) return
          // Drop a load that a newer image or a hide overtook, or that another sync added.
          const latest = latestProjectRef.current.speakers.find((s) => s.id === layerId)
          if (!latest?.visible || (latest.cutoutUrl || latest.sourceImageUrl) !== imageSrc) return
          if (live.getObjects().some((o) => o.data?.layerId === layerId)) return
          // Auto-frame may have moved the speaker while the image decoded.
          const { transform } = latest
          img.set({
            data: { layerId, currentSrc: imageSrc },
            left: transform.x,
            top: transform.y,
            scaleX: transform.scaleX,
            scaleY: transform.scaleY,
            angle: transform.rotation,
            flipX: !!transform.flipX,
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
          reorderCanvasObjects(canvas, latestProjectRef.current.layerOrder)
          canvas.requestRenderAll()
        },
        { crossOrigin: 'anonymous' }
      )
    }
  }

  // Helper function to sync text object
  const syncTextObject = (canvas, textState, layerId) => {
    let existing = canvas.getObjects().find((o) => o.data?.layerId === layerId)

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

    // State is immutable, so the same object means nothing about this headline changed.
    if (existing && existing.data.lastState === textState) return

    if (existing) {
      existing.data.lastState = textState
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
        data: { layerId, lastState: textState },
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
        onUpdateTextLayer?.({ text: textObj.text }, layerId)
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
        const textObj = fabricCanvasRef.current?.getObjects().find((o) => o.data?.layerId === layerId)
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

  // Elements (stickers): one object each, rebuilt from state on every sync.
  const syncStickerObjects = (canvas, stickers) => {
    const ids = new Set(stickers.map((s) => s.id))
    canvas
      .getObjects()
      .filter((o) => o.data?.layerId && isStickerLayer(o.data.layerId) && !ids.has(o.data.layerId))
      .forEach((o) => canvas.remove(o))
    for (const sticker of stickers) {
      let obj = canvas.getObjects().find((o) => o.data?.layerId === sticker.id)
      if (!sticker.visible) {
        if (obj) canvas.remove(obj)
        continue
      }
      if (!obj) {
        obj = new ElementObject({ data: { layerId: sticker.id } })
        canvas.add(obj)
      } else if (obj.sticker === sticker) {
        // Unchanged: re-setting would mark it dirty and redraw its cache on every edit.
        continue
      }
      obj.set(elementObjectProps(sticker))
      obj.setCoords()
    }
    // Labels use a web font; redraw once it has loaded.
    if (stickers.length && document.fonts && !document.fonts.check('40px Anton')) {
      document.fonts.load('40px Anton').then(() => {
        fabricCanvasRef.current?.getObjects().forEach((o) => {
          if (isStickerLayer(o.data?.layerId || '')) o.dirty = true
        })
        fabricCanvasRef.current?.requestRenderAll()
      })
    }
  }

  // Bugs (logos): one image each. The image is reloaded only when its source changes;
  // the stored width/height become the object's scale.
  const syncBugObjects = (canvas, bugs) => {
    const ids = new Set(bugs.map((b) => b.id))
    canvas
      .getObjects()
      .filter((o) => o.data?.layerId && isBugLayer(o.data.layerId) && !ids.has(o.data.layerId))
      .forEach((o) => canvas.remove(o))
    for (const bug of bugs) {
      const existing = canvas.getObjects().find((o) => o.data?.layerId === bug.id)
      if (!bug.visible) {
        if (existing) canvas.remove(existing)
        continue
      }
      const placement = (img) => ({
        left: bug.x,
        top: bug.y,
        scaleX: bug.width / (img.width || 1),
        scaleY: bug.height / (img.height || 1),
        angle: bug.rotation,
        flipX: !!bug.flipX,
        opacity: bug.opacity,
        shadow: bug.shadow
          ? new fabric.Shadow({ color: 'rgba(0,0,0,0.6)', blur: 12, offsetX: 3, offsetY: 5 })
          : null,
      })
      if (existing && existing.data?.currentSrc === bug.imageUrl) {
        if (existing.data.lastState === bug) continue
        existing.data.lastState = bug
        existing.set(placement(existing))
        existing.setCoords()
        continue
      }
      if (existing) canvas.remove(existing)
      fabric.Image.fromURL(
        bug.imageUrl,
        (img) => {
          const live = fabricCanvasRef.current
          if (!live || live !== canvas) return
          // A sync that ran while this image loaded may already have added it.
          if (live.getObjects().some((o) => o.data?.layerId === bug.id)) return
          img.set({
            data: { layerId: bug.id, currentSrc: bug.imageUrl, lastState: bug },
            originX: 'center',
            originY: 'center',
            perPixelTargetFind: true,
            targetFindTolerance: 6,
            cornerColor: '#38BDF8',
            cornerSize: 12,
            transparentCorners: false,
            borderColor: '#0284C7',
            lockUniScaling: false,
          })
          img.set(placement(img))
          img.setCoords()
          live.add(img)
          reorderCanvasObjects(live, latestProjectRef.current.layerOrder)
          live.requestRenderAll()
        },
        { crossOrigin: 'anonymous' }
      )
    }
  }

  // Graphics layer: one click-through object, redrawn from the project's decor settings.
  const syncDecorObject = (canvas, decor) => {
    let existing = canvas.getObjects().find((o) => o.data?.layerId === DECOR_LAYER_ID)
    if (!decor?.visible) {
      if (existing) canvas.remove(existing)
      return
    }
    if (!existing) {
      existing = new DecorLayer({ data: { layerId: DECOR_LAYER_ID } })
      canvas.add(existing)
    }
    existing.set({ decor })
  }

  // Reorder Fabric canvas objects based on layerOrder array
  const reorderCanvasObjects = (canvas, layerOrder) => {
    const objects = canvas.getObjects()
    withDecorLayer(layerOrder).forEach((layerId, targetIndex) => {
      const obj = objects.find((o) => o.data?.layerId === layerId)
      if (obj) {
        canvas.moveTo(obj, targetIndex)
      }
    })
  }

  // Expose imperative API for exact project-sized export.
  useImperativeHandle(ref, () => ({
    getCanvas: () => fabricCanvasRef.current,
    /** The headline's box in canvas px (centre, size, rotation), or null when it's hidden. */
    getHeadlineBox: () => {
      const text = fabricCanvasRef.current?.getObjects().find((o) => o.data?.layerId === 'text')
      if (!text || !text.visible) return null
      return {
        x: text.left,
        y: text.top,
        width: text.getScaledWidth(),
        height: text.getScaledHeight(),
        rotation: text.angle || 0,
      }
    },
    exportThumbnail: ({ format = 'jpeg', quality = 0.92, filename, scale = 1 }) => {
      const canvas = fabricCanvasRef.current
      if (!canvas) return null

      // Deselect before export
      canvas.discardActiveObject()
      canvas.renderAll()

      // Compensate for the editor zoom, then apply the requested output scale.
      const currentZoom = canvas.getZoom()
      const multiplier = (1 / currentZoom) * scale

      const dataUrl = canvas.toDataURL({
        format: format === 'png' ? 'png' : 'jpeg',
        quality: format === 'png' ? 1.0 : quality,
        multiplier: multiplier,
      })

      const name =
        filename ||
        `youtube-thumbnail-${Math.round(canvasWidth * scale)}x${Math.round(canvasHeight * scale)}-${new Date().toISOString().slice(0, 10)}.${
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
          className="relative overflow-hidden rounded-lg shadow-inner bg-black flex items-center justify-center"
          style={{ aspectRatio, maxHeight: '100%', maxWidth: '100%' }}
        >
          <canvas ref={canvasElRef} />
        </div>
      </div>
    </div>
  )
})

export default ThumbnailStudioCanvas
