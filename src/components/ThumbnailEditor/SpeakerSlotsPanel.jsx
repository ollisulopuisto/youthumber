import { useRef } from 'react'

function SpeakerSlotsPanel({
  project,
  onUploadSpeakerSource,
  onTriggerRemoveBackground,
  onRemoveSpeaker,
  onUploadBackgroundImage,
  onClearBackgroundImage,
}) {
  const speaker1InputRef = useRef(null)
  const speaker2InputRef = useRef(null)
  const bgInputRef = useRef(null)

  const handleFileChange = (e, callback) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      callback(event.target.result)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const renderSpeakerCard = (slotId, title, inputRef, accentColor) => {
    const speaker = project[slotId]
    const hasSource = !!speaker.sourceImageUrl
    const hasCutout = !!speaker.cutoutUrl
    const isProcessing = speaker.isProcessing

    return (
      <div className="flex-1 min-w-[280px] bg-gray-900 border border-gray-800 rounded-xl p-3 flex flex-col gap-2.5 shadow-lg">
        {/* Card Header */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-1.5">
          <div className="flex items-center gap-2">
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] bg-gray-800 ${accentColor}`}
            >
              {slotId === 'speaker1' ? '1' : '2'}
            </span>
            <span className="font-bold text-xs text-gray-200">{title}</span>
          </div>

          {hasSource && (
            <button
              onClick={() => onRemoveSpeaker(slotId)}
              className="text-[10px] text-red-400 hover:text-red-300 font-medium px-1.5 py-0.5 rounded hover:bg-red-500/10 transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {/* Card Body */}
        {!hasSource ? (
          <div
            onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed border-gray-700 hover:border-gray-500 rounded-lg p-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer bg-gray-800/30 hover:bg-gray-800/60 transition-all text-center group"
          >
            <span className="text-2xl group-hover:scale-110 transition-transform">📸</span>
            <p className="text-xs font-medium text-gray-300">Upload 1920×1080 Photo</p>
            <p className="text-[10px] text-gray-500">JPG, PNG, WebP supported</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {/* Previews: Source + Alpha Mask + Cutout */}
            <div className="flex items-center gap-2">
              {/* Source Preview */}
              <div className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full h-16 rounded bg-gray-950 border border-gray-800 overflow-hidden flex items-center justify-center">
                  <img
                    src={speaker.sourceImageUrl}
                    alt="Source"
                    className="w-full h-full object-cover"
                  />
                </div>
                <span className="text-[9px] text-gray-500 font-medium">Original</span>
              </div>

              {/* Mask Preview (if available) */}
              {speaker.maskUrl && (
                <div className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full h-16 rounded bg-gray-950 border border-gray-800 overflow-hidden flex items-center justify-center">
                    <img
                      src={speaker.maskUrl}
                      alt="Alpha Mask"
                      className="w-full h-full object-cover invert"
                    />
                  </div>
                  <span className="text-[9px] text-gray-500 font-medium">Alpha Mask</span>
                </div>
              )}

              {/* Cutout Preview */}
              <div className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full h-16 rounded bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:8px_8px] bg-gray-950 border border-gray-800 overflow-hidden flex items-center justify-center">
                  {hasCutout ? (
                    <img
                      src={speaker.cutoutUrl}
                      alt="Cutout"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <span className="text-[10px] text-gray-500">Not Cut Out</span>
                  )}
                </div>
                <span className="text-[9px] text-gray-500 font-medium">Cutout</span>
              </div>
            </div>

            {/* Action Buttons & Progress */}
            {isProcessing ? (
              <div className="flex flex-col gap-1 mt-1">
                <div className="flex justify-between text-[10px] text-amber-400 font-medium">
                  <span>{speaker.processingStatus || 'Removing background...'}</span>
                  <span>{speaker.processingProgress}%</span>
                </div>
                <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-amber-500 to-red-500 h-full transition-all duration-200"
                    style={{ width: `${speaker.processingProgress}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-1">
                <button
                  onClick={() => onTriggerRemoveBackground(slotId)}
                  className={`flex-1 py-1.5 rounded text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1 ${
                    hasCutout
                      ? 'bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700'
                      : 'bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white'
                  }`}
                >
                  <span>✨ {hasCutout ? 'Re-run Remover' : 'Remove Background'}</span>
                </button>

                <button
                  onClick={() => inputRef.current?.click()}
                  className="px-2.5 py-1.5 rounded text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 transition-colors"
                  title="Replace with new photo"
                >
                  Replace
                </button>
              </div>
            )}
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) =>
            handleFileChange(e, (dataUrl) => onUploadSpeakerSource(slotId, dataUrl))
          }
        />
      </div>
    )
  }

  return (
    <div className="w-full bg-gray-950/90 border-t border-gray-800 p-3 sm:p-4 flex flex-wrap gap-3 sm:gap-4 items-stretch">
      {/* Speaker 1 Card */}
      {renderSpeakerCard('speaker1', 'Speaker 1 (Left / Host)', speaker1InputRef, 'text-indigo-400')}

      {/* Speaker 2 Card */}
      {renderSpeakerCard('speaker2', 'Speaker 2 (Right / Guest)', speaker2InputRef, 'text-sky-400')}

      {/* Background Slot Card */}
      <div className="flex-1 min-w-[240px] bg-gray-900 border border-gray-800 rounded-xl p-3 flex flex-col gap-2.5 shadow-lg">
        <div className="flex items-center justify-between border-b border-gray-800 pb-1.5">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] bg-gray-800 text-emerald-400">
              B
            </span>
            <span className="font-bold text-xs text-gray-200">Background Layer</span>
          </div>

          {project.background.imageUrl && (
            <button
              onClick={onClearBackgroundImage}
              className="text-[10px] text-red-400 hover:text-red-300 font-medium px-1.5 py-0.5 rounded hover:bg-red-500/10 transition-colors"
            >
              Clear Image
            </button>
          )}
        </div>

        {project.background.imageUrl ? (
          <div className="flex items-center gap-3">
            <div className="w-24 h-16 rounded bg-gray-950 border border-gray-800 overflow-hidden">
              <img
                src={project.background.imageUrl}
                alt="Background"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] text-gray-300 font-medium">Custom Image Active</span>
              <button
                onClick={() => bgInputRef.current?.click()}
                className="text-xs px-2.5 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 w-fit transition-colors"
              >
                Change Photo
              </button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => bgInputRef.current?.click()}
            className="border-2 border-dashed border-gray-700 hover:border-gray-500 rounded-lg p-3 flex flex-col items-center justify-center gap-1 cursor-pointer bg-gray-800/30 hover:bg-gray-800/60 transition-all text-center group"
          >
            <span className="text-xl group-hover:scale-110 transition-transform">🌄</span>
            <p className="text-xs font-medium text-gray-300">Upload Background Photo</p>
            <p className="text-[10px] text-gray-500">Auto-fits 1280×720 canvas</p>
          </div>
        )}

        <input
          ref={bgInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => handleFileChange(e, onUploadBackgroundImage)}
        />
      </div>
    </div>
  )
}

export default SpeakerSlotsPanel
