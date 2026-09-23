import { useEffect, useState } from 'react'
import {
  pickVideoFile,
  scanVideoForBestFrames,
  grabFullResolutionFrame,
} from '../../services/videoScan'

function formatTimestamp(seconds) {
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function VideoScanModal({ onClose, onFrameSelected }) {
  const [phase, setPhase] = useState('picking') // picking | scanning | results | grabbing | error
  const [videoPath, setVideoPath] = useState(null)
  const [candidates, setCandidates] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      try {
        const path = await pickVideoFile()
        if (cancelled) return
        if (!path) {
          onClose()
          return
        }
        setVideoPath(path)
        setPhase('scanning')

        const result = await scanVideoForBestFrames(path)
        if (cancelled) return

        if (!result.length) {
          setError(
            'No frames with a clear, well-framed face were found. The video may be too dark, too zoomed out, or mostly off-camera.'
          )
          setPhase('error')
          return
        }
        setCandidates(result)
        setPhase('results')
      } catch (err) {
        if (cancelled) return
        setError(err.message)
        setPhase('error')
      }
    }

    run()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handlePick = async (candidate) => {
    setPhase('grabbing')
    try {
      const fullResUrl = await grabFullResolutionFrame(videoPath, candidate.timestampSeconds)
      onFrameSelected(fullResUrl)
      onClose()
    } catch (err) {
      setError(err.message)
      setPhase('error')
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-y-auto p-5 shadow-2xl flex flex-col gap-4 text-white">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-200 flex items-center gap-1.5">
            🎬 Scan Video for Best Frame
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 text-xs font-medium"
          >
            ✕ Close
          </button>
        </div>

        {(phase === 'picking' || phase === 'scanning' || phase === 'grabbing') && (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <div className="w-8 h-8 border-2 border-gray-700 border-t-amber-500 rounded-full animate-spin" />
            <p className="text-xs text-gray-400">
              {phase === 'picking' && 'Waiting for file selection…'}
              {phase === 'scanning' &&
                'Scanning video and scoring frames with Apple Vision — this can take a moment for long recordings…'}
              {phase === 'grabbing' && 'Grabbing full-resolution frame…'}
            </p>
          </div>
        )}

        {phase === 'error' && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <span className="text-2xl">⚠️</span>
            <p className="text-xs text-red-400 max-w-sm">{error}</p>
            <button
              onClick={onClose}
              className="text-xs px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 transition-colors"
            >
              Close
            </button>
          </div>
        )}

        {phase === 'results' && (
          <>
            <p className="text-[11px] text-gray-500 -mt-1">
              Top {candidates.length} candidates, ranked by Vision face capture quality + sharpness.
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {candidates.map((c) => (
                <button
                  key={c.timestampSeconds}
                  onClick={() => handlePick(c)}
                  className="group flex flex-col gap-1 rounded-lg overflow-hidden border border-gray-800 hover:border-amber-500 transition-colors text-left bg-gray-950"
                >
                  <div className="aspect-video overflow-hidden bg-gray-950">
                    <img
                      src={c.image}
                      alt={`Candidate frame at ${formatTimestamp(c.timestampSeconds)}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                  <div className="flex items-center justify-between px-1.5 pb-1.5 text-[10px] text-gray-400 font-mono">
                    <span>{formatTimestamp(c.timestampSeconds)}</span>
                    <span className="text-emerald-400">{Math.round(c.score * 100)}%</span>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default VideoScanModal
