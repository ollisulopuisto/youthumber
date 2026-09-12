import { useRef, useState, useEffect } from 'react'
import imageCompression from 'browser-image-compression'
import { defaultRemoverRegistry } from '../../services/background-removal'
import CropModal from '../CropModal'

function UploadPanel({ onImageUpload }) {
  const [isCompressing, setIsCompressing] = useState(false)
  const [isRemovingBg, setIsRemovingBg] = useState(false)
  const [removeBgProgress, setRemoveBgProgress] = useState(0)
  const [showCropModal, setShowCropModal] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [videoFile, setVideoFile] = useState(null)
  const [videoTime, setVideoTime] = useState(0)
  const [videoDuration, setVideoDuration] = useState(0)
  const fileInputRef = useRef(null)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)

  const handleFile = async (file) => {
    // Check if it's a video (by MIME type or extension)
    const videoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-m4v', 'video/x-msvideo']
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.m4v', '.avi']
    const isVideo = videoTypes.includes(file.type) ||
                    videoExtensions.some(ext => file.name.toLowerCase().endsWith(ext))

    if (isVideo) {
      handleVideoFile(file)
      return
    }

    // Validate image file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      alert('Please upload a JPG, PNG, WebP image or MP4, WebM video')
      return
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024 // 10MB in bytes
    if (file.size > maxSize) {
      alert('File size must be less than 10MB')
      return
    }

    // Clear video state
    setVideoFile(null)
    setVideoTime(0)
    setVideoDuration(0)

    // Compress image before converting to base64
    setIsCompressing(true)
    try {
      const compressionOptions = {
        maxSizeMB: 0.5, // Max 500KB for localStorage efficiency
        maxWidthOrHeight: 1920, // Max dimension
        useWebWorker: true,
        fileType: 'image/jpeg' // Convert to JPEG for better compression
      }

      const compressedFile = await imageCompression(file, compressionOptions)

      // Create preview and read compressed file
      const reader = new FileReader()
      reader.onload = (e) => {
        const imageUrl = e.target.result
        setPreviewUrl(imageUrl)
        if (onImageUpload) {
          onImageUpload(imageUrl)
        }
        setIsCompressing(false)
      }
      reader.onerror = () => {
        setIsCompressing(false)
        alert('Error reading compressed image')
      }
      reader.readAsDataURL(compressedFile)
    } catch (error) {
      console.error('Compression error:', error)
      setIsCompressing(false)
      // Fallback: use original file if compression fails
      const reader = new FileReader()
      reader.onload = (e) => {
        const imageUrl = e.target.result
        setPreviewUrl(imageUrl)
        if (onImageUpload) {
          onImageUpload(imageUrl)
        }
      }
      reader.readAsDataURL(file)
    }
  }

  const handleVideoFile = (file) => {
    // Validate file size (max 100MB for videos)
    const maxSize = 100 * 1024 * 1024 // 100MB in bytes
    if (file.size > maxSize) {
      alert('Video file size must be less than 100MB')
      return
    }

    // Clear image preview
    setPreviewUrl(null)

    // Create video URL
    const videoUrl = URL.createObjectURL(file)
    setVideoFile(videoUrl)
    setVideoTime(0)
  }

  const handleVideoLoaded = () => {
    if (videoRef.current) {
      setVideoDuration(videoRef.current.duration)
      // Seek to first frame
      videoRef.current.currentTime = 0
    }
  }

  const handleTimeChange = (e) => {
    const time = parseFloat(e.target.value)
    setVideoTime(time)
    if (videoRef.current) {
      videoRef.current.currentTime = time
    }
  }

  const extractFrame = () => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    // Set canvas size to video size
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Draw current frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    // Get image data
    const imageUrl = canvas.toDataURL('image/jpeg', 0.95)

    // Clear video state
    URL.revokeObjectURL(videoFile)
    setVideoFile(null)
    setVideoTime(0)
    setVideoDuration(0)

    // Set as preview and pass to parent
    setPreviewUrl(imageUrl)
    if (onImageUpload) {
      onImageUpload(imageUrl)
    }
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleRemoveBackground = async () => {
    if (!previewUrl) return

    setIsRemovingBg(true)
    setRemoveBgProgress(0)

    try {
      const remover = defaultRemoverRegistry.getActive()
      const result = await remover.remove(previewUrl, {
        onProgress: (pct) => {
          setRemoveBgProgress(pct)
        }
      })

      let imageUrl = result.image
      if (result.image instanceof Blob) {
        imageUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = (e) => resolve(e.target.result)
          reader.onerror = reject
          reader.readAsDataURL(result.image)
        })
      }

      setPreviewUrl(imageUrl)
      if (onImageUpload) {
        onImageUpload(imageUrl)
      }
      setIsRemovingBg(false)
      setRemoveBgProgress(0)
    } catch (error) {
      console.error('Background removal error:', error)
      alert('Error removing background. Please try again.')
      setIsRemovingBg(false)
      setRemoveBgProgress(0)
    }
  }

  const handleCropConfirm = (croppedUrl) => {
    setPreviewUrl(croppedUrl)
    if (onImageUpload) {
      onImageUpload(croppedUrl)
    }
    setShowCropModal(false)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      handleFile(files[0])
    }
  }

  const handleClick = () => {
    if (!videoFile) {
      fileInputRef.current?.click()
    }
  }

  const handleFileInput = (e) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFile(files[0])
    }
  }

  const handlePaste = (e) => {
    const items = e.clipboardData.items
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile()
        handleFile(file)
        break
      }
    }
  }

  // Cleanup video URL on unmount
  useEffect(() => {
    return () => {
      if (videoFile) {
        URL.revokeObjectURL(videoFile)
      }
    }
  }, [videoFile])

  // Add paste listener when component mounts
  useEffect(() => {
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [])

  return (
    <section>
      <h2 className="text-lg font-semibold mb-3 text-[#E67E22]">
        Upload Image
      </h2>

      {/* Hidden canvas for frame extraction */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Video Frame Extractor */}
      {videoFile && (
        <div className="mb-3 bg-gray-800 rounded-lg p-3 space-y-3">
          <video
            ref={videoRef}
            src={videoFile}
            onLoadedMetadata={handleVideoLoaded}
            className="w-full rounded"
            muted
          />

          <div className="space-y-2">
            <input
              type="range"
              min="0"
              max={videoDuration || 0}
              step="0.1"
              value={videoTime}
              onChange={handleTimeChange}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[#E67E22]"
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>{formatTime(videoTime)}</span>
              <span>{formatTime(videoDuration)}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={extractFrame}
              className="flex-1 px-3 py-2 bg-[#E67E22] text-white rounded text-sm font-medium hover:bg-[#d35400] transition-colors"
            >
              Use This Frame
            </button>
            <button
              onClick={() => {
                URL.revokeObjectURL(videoFile)
                setVideoFile(null)
                setVideoTime(0)
                setVideoDuration(0)
              }}
              className="px-3 py-2 bg-gray-700 text-white rounded text-sm hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Compression indicator */}
      {isCompressing && (
        <div className="mb-3 bg-blue-900/50 border border-blue-700 rounded-lg p-3 flex items-center gap-2">
          <svg className="w-4 h-4 animate-spin text-blue-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm text-blue-300">Compressing image...</span>
        </div>
      )}

      {/* Background removal indicator */}
      {isRemovingBg && (
        <div className="mb-3 bg-purple-900/50 border border-purple-700 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 animate-spin text-purple-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-sm text-purple-300">Removing background... {removeBgProgress}%</span>
          </div>
          <div className="w-full bg-purple-950 rounded-full h-1.5">
            <div
              className="bg-purple-500 h-1.5 rounded-full transition-all"
              style={{ width: `${removeBgProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Image editing buttons */}
      {previewUrl && !videoFile && !isCompressing && !isRemovingBg && (
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setShowCropModal(true)}
            className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h2m10-2h2a2 2 0 002-2v-2M6 8H4a2 2 0 00-2 2v2m16-2V8a2 2 0 00-2-2h-2M9 12h6m-3-3v6" />
            </svg>
            Crop
          </button>
          <button
            onClick={handleRemoveBackground}
            className="flex-1 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Remove BG
          </button>
        </div>
      )}

      {/* Upload Area */}
      <div
        className={`
          border-2 border-dashed rounded-lg p-6 text-center
          transition-all cursor-pointer
          ${isDragging
            ? 'border-[#E67E22] bg-[#E67E22]/10'
            : 'border-gray-600 hover:border-[#E67E22]'
          }
          ${videoFile || isCompressing || isRemovingBg ? 'opacity-50 pointer-events-none' : ''}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        {previewUrl ? (
          <div className="space-y-2">
            <img
              src={previewUrl}
              alt="Preview"
              className="w-full h-32 object-cover rounded"
            />
            <p className="text-xs text-gray-400">
              Click or drop to change
            </p>
          </div>
        ) : (
          <>
            <div className="text-4xl mb-2">📁</div>
            <p className="text-sm text-gray-300 mb-1">
              Drag & drop or click to upload
            </p>
            <p className="text-xs text-gray-500">
              Image (JPG, PNG, WebP) or Video (MP4, WebM)
            </p>
            <p className="text-xs text-gray-600 mt-2">
              💡 Tip: You can also paste (Ctrl+V)
            </p>
          </>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/ogg"
          onChange={handleFileInput}
          className="hidden"
        />
      </div>

      {/* Crop Modal */}
      {showCropModal && previewUrl && (
        <CropModal
          imageUrl={previewUrl}
          onConfirm={handleCropConfirm}
          onCancel={() => setShowCropModal(false)}
        />
      )}
    </section>
  )
}

export default UploadPanel
