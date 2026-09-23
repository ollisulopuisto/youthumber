import { useRef, useState } from 'react'
import { isDesktopVideoScanAvailable } from '../../services/videoScan'
import { positionLabels } from '../../modules/thumbnail/layouts'
import VideoScanModal from './VideoScanModal'

function readFileAsDataUrl(e, callback) {
  const file = e.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (event) => callback(event.target.result)
  reader.readAsDataURL(file)
  e.target.value = ''
}

function SpeakerCard({
  speaker,
  index,
  count,
  videoScanAvailable,
  onUploadSpeakerSource,
  onTriggerRemoveBackground,
  onAutoFrameSpeaker,
  onRemoveSpeaker,
  onRenameSpeaker,
  onMoveSpeaker,
  onOpenVideoScan,
}) {
  const inputRef = useRef(null)
  const hasSource = !!speaker.sourceImageUrl
  const hasCutout = !!speaker.cutoutUrl
  const position = positionLabels(count)[index]

  return (
    <div className="flex-1 min-w-[240px] bg-gray-900 border border-gray-800 rounded-xl p-3 flex flex-col gap-2.5 shadow-lg">
      {/* Header: position, editable name, move left/right, clear */}
      <div className="flex items-center justify-between gap-2 border-b border-gray-800 pb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-wide text-sky-400 shrink-0">
            {position}
          </span>
          <span className="text-gray-600" aria-hidden="true">
            ·
          </span>
          <input
            type="text"
            value={speaker.name}
            onChange={(e) => onRenameSpeaker(speaker.id, e.target.value)}
            placeholder="Name"
            aria-label={`${position} speaker name`}
            className="min-w-0 flex-1 bg-transparent hover:bg-gray-800 focus:bg-gray-800 rounded px-1 py-0.5 text-xs font-bold text-gray-200 outline-none border border-transparent focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {count > 1 && (
            <>
              <button
                onClick={() => onMoveSpeaker(speaker.id, -1)}
                disabled={index === 0}
                className="w-5 h-5 rounded text-[11px] bg-gray-800 hover:bg-gray-700 disabled:opacity-30 text-gray-300"
                title="Move left"
                aria-label={`Move ${speaker.name} left`}
              >
                ←
              </button>
              <button
                onClick={() => onMoveSpeaker(speaker.id, 1)}
                disabled={index === count - 1}
                className="w-5 h-5 rounded text-[11px] bg-gray-800 hover:bg-gray-700 disabled:opacity-30 text-gray-300"
                title="Move right"
                aria-label={`Move ${speaker.name} right`}
              >
                →
              </button>
            </>
          )}
          {hasSource && (
            <button
              onClick={() => onRemoveSpeaker(speaker.id)}
              className="text-[10px] text-red-400 hover:text-red-300 font-medium px-1.5 py-0.5 rounded hover:bg-red-500/10 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {!hasSource ? (
        <div className="flex flex-col gap-2">
          <button
            onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed border-gray-700 hover:border-gray-500 rounded-lg p-4 flex flex-col items-center justify-center gap-1.5 bg-gray-800/30 hover:bg-gray-800/60 transition-all text-center group"
          >
            <span className="text-2xl group-hover:scale-110 transition-transform">📸</span>
            <span className="text-xs font-medium text-gray-300">Upload 1920×1080 Photo</span>
            <span className="text-[10px] text-gray-500">JPG, PNG, WebP supported</span>
          </button>
          {videoScanAvailable && (
            <button
              onClick={() => onOpenVideoScan(speaker.id)}
              className="text-xs py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-amber-300 border border-gray-700 transition-colors"
            >
              🎬 Pick a frame from a video
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full h-16 rounded bg-gray-950 border border-gray-800 overflow-hidden">
                <img src={speaker.sourceImageUrl} alt="Original" className="w-full h-full object-cover" />
              </div>
              <span className="text-[9px] text-gray-500 font-medium">Original</span>
            </div>
            {speaker.maskUrl && (
              <div className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full h-16 rounded bg-gray-950 border border-gray-800 overflow-hidden">
                  <img src={speaker.maskUrl} alt="Alpha mask" className="w-full h-full object-cover invert" />
                </div>
                <span className="text-[9px] text-gray-500 font-medium">Alpha Mask</span>
              </div>
            )}
            <div className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full h-16 rounded bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:8px_8px] bg-gray-950 border border-gray-800 overflow-hidden flex items-center justify-center">
                {hasCutout ? (
                  <img src={speaker.cutoutUrl} alt="Cutout" className="w-full h-full object-contain" />
                ) : (
                  <span className="text-[10px] text-gray-500">Not Cut Out</span>
                )}
              </div>
              <span className="text-[9px] text-gray-500 font-medium">Cutout</span>
            </div>
          </div>

          {speaker.isProcessing ? (
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
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              <button
                onClick={() => onTriggerRemoveBackground(speaker.id)}
                className={`flex-1 py-1.5 rounded text-xs font-bold transition-all shadow-sm ${
                  hasCutout
                    ? 'bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700'
                    : 'bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white'
                }`}
              >
                ✨ {hasCutout ? 'Re-run Remover' : 'Remove Background'}
              </button>
              {hasCutout && (
                <button
                  onClick={() => onAutoFrameSpeaker(speaker.id)}
                  className="px-2 py-1.5 rounded text-xs bg-gray-800 hover:bg-gray-700 text-emerald-300 border border-gray-700"
                  title="Fit this person into their slot"
                >
                  🎯 Auto-Frame
                </button>
              )}
              <button
                onClick={() => inputRef.current?.click()}
                className="px-2 py-1.5 rounded text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700"
                title="Replace with a new photo"
              >
                Replace
              </button>
              {videoScanAvailable && (
                <button
                  onClick={() => onOpenVideoScan(speaker.id)}
                  className="px-2 py-1.5 rounded text-xs bg-gray-800 hover:bg-gray-700 text-amber-300 border border-gray-700"
                  title="Pick a different frame from a video"
                >
                  🎬 Video
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => readFileAsDataUrl(e, (dataUrl) => onUploadSpeakerSource(speaker.id, dataUrl))}
      />
    </div>
  )
}

function SpeakerSlotsPanel({
  project,
  onUploadSpeakerSource,
  onTriggerRemoveBackground,
  onAutoFrameSpeaker,
  onRemoveSpeaker,
  onRenameSpeaker,
  onMoveSpeaker,
  onUploadBackgroundImage,
  onClearBackgroundImage,
}) {
  const bgInputRef = useRef(null)
  const [videoScanTarget, setVideoScanTarget] = useState(undefined) // undefined = closed, null = no target
  const [lastScan, setLastScan] = useState(null) // { path, people } — reused across slots
  const videoScanAvailable = isDesktopVideoScanAvailable()

  return (
    <div className="w-full bg-gray-950/90 border-t border-gray-800 p-3 sm:p-4 flex flex-col gap-3">
      {videoScanAvailable && (
        <div className="flex justify-end">
          <button
            onClick={() => setVideoScanTarget(null)}
            className="text-xs px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-amber-300 border border-gray-700 transition-colors"
            title="Scan one video and pick frames for every speaker"
          >
            🎬 Pick speaker frames from a video
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-3 sm:gap-4 items-stretch">
        {project.speakers.map((speaker, index) => (
          <SpeakerCard
            key={speaker.id}
            speaker={speaker}
            index={index}
            count={project.speakers.length}
            videoScanAvailable={videoScanAvailable}
            onUploadSpeakerSource={onUploadSpeakerSource}
            onTriggerRemoveBackground={onTriggerRemoveBackground}
            onAutoFrameSpeaker={onAutoFrameSpeaker}
            onRemoveSpeaker={onRemoveSpeaker}
            onRenameSpeaker={onRenameSpeaker}
            onMoveSpeaker={onMoveSpeaker}
            onOpenVideoScan={setVideoScanTarget}
          />
        ))}

        {/* Background card */}
        <div className="flex-1 min-w-[220px] bg-gray-900 border border-gray-800 rounded-xl p-3 flex flex-col gap-2.5 shadow-lg">
          <div className="flex items-center justify-between border-b border-gray-800 pb-1.5">
            <span className="font-bold text-xs text-gray-200">Background</span>
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
                <img src={project.background.imageUrl} alt="Background" className="w-full h-full object-cover" />
              </div>
              <button
                onClick={() => bgInputRef.current?.click()}
                className="text-xs px-2.5 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 transition-colors"
              >
                Change Photo
              </button>
            </div>
          ) : (
            <button
              onClick={() => bgInputRef.current?.click()}
              className="border-2 border-dashed border-gray-700 hover:border-gray-500 rounded-lg p-3 flex flex-col items-center justify-center gap-1 bg-gray-800/30 hover:bg-gray-800/60 transition-all text-center group"
            >
              <span className="text-xl group-hover:scale-110 transition-transform">🌄</span>
              <span className="text-xs font-medium text-gray-300">Upload Background Photo</span>
              <span className="text-[10px] text-gray-500">Auto-fits 1280×720 canvas</span>
            </button>
          )}

          <input
            ref={bgInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => readFileAsDataUrl(e, onUploadBackgroundImage)}
          />
        </div>
      </div>

      {videoScanTarget !== undefined && (
        <VideoScanModal
          project={project}
          targetSpeakerId={videoScanTarget}
          scan={lastScan}
          onScanComplete={setLastScan}
          onAssign={onUploadSpeakerSource}
          onClose={() => setVideoScanTarget(undefined)}
        />
      )}
    </div>
  )
}

export default SpeakerSlotsPanel
