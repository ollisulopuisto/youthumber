import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { fabric } from 'fabric'
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../../modules/thumbnail/thumbnailState'

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

      if (layerId === 'speaker1' || layerId === 'speaker2') {
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
        })
      }
    })

    // Handle responsive container scaling
    const updateCanvasScale = () => {
      if (!containerRef.current || !fabricCanvasRef.current) return
      const containerWidth = containerRef.current.clientWidth
      const scale = containerWidth / CANVAS_WIDTH
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

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    updateCanvasScale()
    onCanvasReady?.()

    return () => {
      resizeObserver.disconnect()
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
    if (project.background.type === 'gradient' && project.background.gradient) {
      const { colors, angle = 135 } = project.background.gradient
      const cx = CANVAS_WIDTH / 2
      const cy = CANVAS_HEIGHT / 2
      const len = Math.sqrt(CANVAS_WIDTH ** 2 + CANVAS_HEIGHT ** 2) / 2
      const rad = (angle * Math.PI) / 180
      const dx = Math.cos(rad) * len
      const dy = Math.sin(rad) * len
      const grad = new fabric.Gradient({
        type: 'linear',
        coords: { x1: cx - dx, y1: cy - dy, x2: cx + dx, y2: cy + dy },
        colorStops: colors.map((color, index) => ({
          offset: index / Math.max(colors.length - 1, 1),
          color,
        })),
      })
      canvas.setBackgroundColor(grad, () => canvas.renderAll())
      canvas.setBackgroundImage(null, () => canvas.renderAll())
    } else if (project.background.type === 'solid' || !project.background.imageUrl) {
      canvas.setBackgroundColor(project.background.color || '#111827', () => canvas.renderAll())
      canvas.setBackgroundImage(null, () => canvas.renderAll())
    } else if (project.background.imageUrl) {
      fabric.Image.fromURL(
        project.background.imageUrl,
        (img) => {
          if (!fabricCanvasRef.current) return
          // Scale to cover 1280x720 canvas
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
          canvas.setBackgroundImage(img, () => canvas.renderAll())
        },
        { crossOrigin: 'anonymous' }
      )
    }

    // Helper to find existing object by layerId
    const findObj = (layerId) => canvas.getObjects().find((o) => o.data?.layerId === layerId)

    // Sync Speaker 1
    syncSpeakerObject(canvas, project.speaker1, 'speaker1')

    // Sync Speaker 2
    syncSpeakerObject(canvas, project.speaker2, 'speaker2')

    // Sync Text layer
    syncTextObject(canvas, project.text)

    // Reorder layers according to project.layerOrder
    reorderCanvasObjects(canvas, project.layerOrder)

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
        fill: textState.fillColor || '#FFFFFF',
        stroke: textState.strokeColor || '#000000',
        strokeWidth: textState.strokeWidth || 0,
        shadow: shadow,
        left: textState.transform.x,
        top: textState.transform.y,
        scaleX: textState.transform.scaleX,
        scaleY: textState.transform.scaleY,
        angle: textState.transform.rotation,
        originX: 'center',
        originY: 'center',
      })
      existing.setCoords()
    } else {
      const textObj = new fabric.IText(textState.text || 'EPISODE TITLE', {
        data: { layerId: 'text' },
        left: textState.transform.x,
        top: textState.transform.y,
        fontFamily: textState.fontFamily || 'Montserrat',
        fontSize: textState.fontSize || 64,
        fontWeight: textState.fontWeight || 'bold',
        fontStyle: textState.fontStyle || 'normal',
        textAlign: textState.textAlign || 'center',
        fill: textState.fillColor || '#FFFFFF',
        stroke: textState.strokeColor || '#000000',
        strokeWidth: textState.strokeWidth || 0,
        shadow: shadow,
        originX: 'center',
        originY: 'center',
        cornerColor: '#F59E0B',
        cornerSize: 12,
        transparentCorners: false,
        borderColor: '#D97706',
      })

      // Update text in project state on inline edit
      textObj.on('changed', () => {
        onUpdateTextLayer?.({ text: textObj.text })
      })

      canvas.add(textObj)
      reorderCanvasObjects(canvas, project.layerOrder)
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

      // Trigger browser download
      const name =
        filename ||
        `youtube-thumbnail-1280x720-${new Date().toISOString().slice(0, 10)}.${
          format === 'png' ? 'png' : 'jpg'
        }`
      const link = document.createElement('a')
      link.download = name
      link.href = dataUrl
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      return dataUrl
    },
  }))

  return (
    <div className="w-full flex items-center justify-center p-2 sm:p-4 bg-gray-950/80 rounded-xl border border-gray-800 shadow-2xl">
      <div
        ref={containerRef}
        className="w-full max-w-[1280px] aspect-[16/9] relative overflow-hidden rounded-lg shadow-inner bg-black flex items-center justify-center"
      >
        <canvas ref={canvasElRef} />
      </div>
    </div>
  )
})

export default ThumbnailStudioCanvas
