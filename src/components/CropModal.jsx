import { useState, useRef, useEffect } from 'react'

function CropModal({ imageUrl, onConfirm, onCancel }) {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)
  const [cropArea, setCropArea] = useState({ x: 50, y: 50, width: 200, height: 150 })
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 })

  // Load image and set initial crop area
  useEffect(() => {
    const img = new Image()
    img.onload = () => {

      // Calculate display size (fit in container)
      const maxWidth = 600
      const maxHeight = 400
      const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1)
      const displayWidth = img.width * scale
      const displayHeight = img.height * scale
      setDisplaySize({ width: displayWidth, height: displayHeight })

      // Set initial crop area (centered, 70% of image)
      const cropWidth = displayWidth * 0.7
      const cropHeight = displayHeight * 0.7
      setCropArea({
        x: (displayWidth - cropWidth) / 2,
        y: (displayHeight - cropHeight) / 2,
        width: cropWidth,
        height: cropHeight
      })
    }
    img.src = imageUrl
  }, [imageUrl])

  const handleMouseDown = (e, action) => {
    e.preventDefault()
    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    setDragStart({ x: x - cropArea.x, y: y - cropArea.y })

    if (action === 'move') {
      setIsDragging(true)
    } else if (action === 'resize') {
      setIsResizing(true)
    }
  }

  const handleMouseMove = (e) => {
    if (!isDragging && !isResizing) return

    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    if (isDragging) {
      const newX = Math.max(0, Math.min(x - dragStart.x, displaySize.width - cropArea.width))
      const newY = Math.max(0, Math.min(y - dragStart.y, displaySize.height - cropArea.height))
      setCropArea(prev => ({ ...prev, x: newX, y: newY }))
    } else if (isResizing) {
      const newWidth = Math.max(50, Math.min(x - cropArea.x, displaySize.width - cropArea.x))
      const newHeight = Math.max(50, Math.min(y - cropArea.y, displaySize.height - cropArea.y))
      setCropArea(prev => ({ ...prev, width: newWidth, height: newHeight }))
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    setIsResizing(false)
  }

  const handleCrop = () => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    const img = new Image()
    img.onload = () => {
      // Calculate scale between display and actual image
      const scaleX = img.width / displaySize.width
      const scaleY = img.height / displaySize.height

      // Calculate actual crop coordinates
      const actualX = cropArea.x * scaleX
      const actualY = cropArea.y * scaleY
      const actualWidth = cropArea.width * scaleX
      const actualHeight = cropArea.height * scaleY

      // Set canvas size to crop size
      canvas.width = actualWidth
      canvas.height = actualHeight

      // Draw cropped portion
      ctx.drawImage(
        img,
        actualX, actualY, actualWidth, actualHeight,
        0, 0, actualWidth, actualHeight
      )

      // Get cropped image as data URL
      const croppedUrl = canvas.toDataURL('image/jpeg', 0.95)
      onConfirm(croppedUrl)
    }
    img.src = imageUrl
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#2a2a2a] rounded-lg max-w-3xl w-full">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Crop Image</h3>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Crop Area */}
        <div className="p-4">
          <div
            ref={containerRef}
            className="relative mx-auto bg-gray-900 rounded overflow-hidden"
            style={{ width: displaySize.width, height: displaySize.height }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* Background Image */}
            <img
              src={imageUrl}
              alt="Crop preview"
              className="w-full h-full object-contain"
              draggable={false}
            />

            {/* Darkened overlay */}
            <div className="absolute inset-0 bg-black/50 pointer-events-none" />

            {/* Crop selection */}
            <div
              className="absolute border-2 border-white cursor-move"
              style={{
                left: cropArea.x,
                top: cropArea.y,
                width: cropArea.width,
                height: cropArea.height,
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)'
              }}
              onMouseDown={(e) => handleMouseDown(e, 'move')}
            >
              {/* Clear area (show original image) */}
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ pointerEvents: 'none' }}
              >
                <img
                  src={imageUrl}
                  alt=""
                  className="absolute"
                  style={{
                    width: displaySize.width,
                    height: displaySize.height,
                    left: -cropArea.x,
                    top: -cropArea.y
                  }}
                  draggable={false}
                />
              </div>

              {/* Resize handle */}
              <div
                className="absolute bottom-0 right-0 w-4 h-4 bg-white cursor-se-resize"
                onMouseDown={(e) => {
                  e.stopPropagation()
                  handleMouseDown(e, 'resize')
                }}
              />

              {/* Corner guides */}
              <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-white" />
              <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-white" />
              <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-white" />
            </div>
          </div>

          <p className="text-xs text-gray-500 text-center mt-3">
            Drag to move, use corner handle to resize
          </p>
        </div>

        {/* Hidden canvas for cropping */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Actions */}
        <div className="px-4 py-3 border-t border-gray-700 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCrop}
            className="px-4 py-2 bg-[#E67E22] hover:bg-[#d35400] text-white rounded text-sm font-medium transition-colors"
          >
            Apply Crop
          </button>
        </div>
      </div>
    </div>
  )
}

export default CropModal
