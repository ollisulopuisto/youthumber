import { useEffect, useState } from 'react'
import {
  pickVideoFile,
  scanVideoForSpeakers,
  grabFullResolutionFrame,
} from '../../services/videoScan'
import { speakerLabel } from '../../modules/thumbnail/thumbnailState'

const MAX_PEOPLE = 6

function formatTimestamp(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.round(seconds % 60)
  const mm = String(m).padStart(h ? 2 : 1, '0')
  return `${h ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`
}

function fileName(path) {
  return path?.split('/').pop() ?? ''
}

/**
 * Scan a video once, see up to 12 frames per detected person, click a frame to view it
 * large, and put it on any speaker position. The last scan is kept by the parent
 * (`scan` / `onScanComplete`) so opening the picker for another speaker doesn't rescan.
 */
function VideoScanModal({ project, targetSpeakerId, scan, onScanComplete, onAssign, onClose }) {
  const [phase, setPhase] = useState(scan ? 'results' : 'setup') // setup | scanning | results | error
  const [numPeople, setNumPeople] = useState(Math.min(MAX_PEOPLE, project.speakers.length))
  const [error, setError] = useState(null)
  const [viewing, setViewing] = useState(null) // { personIndex, frameIndex }
  const [pendingSpeakerId, setPendingSpeakerId] = useState(null)
  const [assigned, setAssigned] = useState({}) // speakerId -> timestampSeconds

  const people = scan?.people ?? []

  const startScan = async () => {
    setError(null)
    try {
      const path = await pickVideoFile()
      if (!path) return
      setPhase('scanning')
      const result = await scanVideoForSpeakers(path, { numPeople })
      if (!result.length) {
        setError(
          'No clear, well-framed faces were found. The video may be too dark, too zoomed out, or people are rarely on camera.'
        )
        setPhase('error')
        return
      }
      onScanComplete({ path, people: result })
      setAssigned({})
      setPhase('results')
    } catch (err) {
      setError(err.message)
      setPhase('error')
    }
  }

  const assign = async (speakerId, frame) => {
    setPendingSpeakerId(speakerId)
    try {
      const fullResUrl = await grabFullResolutionFrame(scan.path, frame.timestampSeconds)
      onAssign(speakerId, fullResUrl)
      setAssigned((prev) => ({ ...prev, [speakerId]: frame.timestampSeconds }))
    } catch (err) {
      setError(err.message)
    } finally {
      setPendingSpeakerId(null)
    }
  }

  const viewedFrames = viewing ? people[viewing.personIndex]?.frames ?? [] : []
  const viewedFrame = viewing ? viewedFrames[viewing.frameIndex] : null

  useEffect(() => {
    if (!viewing) return
    const onKey = (e) => {
      if (e.key === 'Escape') setViewing(null)
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const delta = e.key === 'ArrowRight' ? 1 : -1
        setViewing((v) => ({
          ...v,
          frameIndex: (v.frameIndex + delta + viewedFrames.length) % viewedFrames.length,
        }))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [viewing, viewedFrames.length])

  // Target speaker first, so "use for this slot" is the obvious button.
  const speakersInOrder = [...project.speakers].sort(
    (a, b) => (b.id === targetSpeakerId) - (a.id === targetSpeakerId)
  )

  const assignButtons = (frame, size = 'sm') => (
    <div className="flex flex-wrap gap-1.5">
      {speakersInOrder.map((speaker) => {
        const isTarget = speaker.id === targetSpeakerId
        const isAssignedHere = assigned[speaker.id] === frame.timestampSeconds
        return (
          <button
            key={speaker.id}
            onClick={() => assign(speaker.id, frame)}
            disabled={pendingSpeakerId !== null}
            className={`rounded border transition-colors disabled:opacity-50 ${
              size === 'lg' ? 'text-xs px-3 py-1.5' : 'text-[11px] px-2 py-1'
            } ${
              isAssignedHere
                ? 'bg-emerald-700/40 border-emerald-500 text-emerald-200'
                : isTarget
                  ? 'bg-amber-600 hover:bg-amber-500 border-amber-500 text-white'
                  : 'bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-200'
            }`}
          >
            {pendingSpeakerId === speaker.id
              ? '…'
              : `${isAssignedHere ? '✓' : '→'} ${speakerLabel(project, speaker.id)}`}
          </button>
        )
      })}
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto p-5 shadow-2xl flex flex-col gap-4 text-white">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-gray-200">🎬 Pick speaker frames from a video</h2>
          <div className="flex items-center gap-3">
            {phase === 'results' && (
              <button
                onClick={() => setPhase('setup')}
                className="text-xs text-gray-400 hover:text-gray-200 underline"
              >
                Scan another video
              </button>
            )}
            <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xs font-medium">
              ✕ Close
            </button>
          </div>
        </div>

        {phase === 'setup' && (
          <div className="flex flex-col items-center gap-4 py-10">
            <label className="flex items-center gap-2 text-xs text-gray-300">
              People in the video
              <input
                type="number"
                min={1}
                max={MAX_PEOPLE}
                value={numPeople}
                onChange={(e) =>
                  setNumPeople(Math.min(MAX_PEOPLE, Math.max(1, Number(e.target.value) || 1)))
                }
                className="w-14 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-100"
              />
            </label>
            <p className="text-[11px] text-gray-500 max-w-sm text-center">
              Count everyone who is on camera, even people you will leave off the thumbnail.
            </p>
            <button
              onClick={startScan}
              className="px-4 py-2 rounded bg-amber-600 hover:bg-amber-500 text-sm font-bold"
            >
              Choose video…
            </button>
          </div>
        )}

        {phase === 'scanning' && (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <div className="w-8 h-8 border-2 border-gray-700 border-t-amber-500 rounded-full animate-spin" />
            <p className="text-xs text-gray-400 text-center max-w-md">
              Scanning the video and grouping faces with Apple Vision — a long recording takes a
              minute or two…
            </p>
          </div>
        )}

        {phase === 'error' && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <span className="text-2xl">⚠️</span>
            <p className="text-xs text-red-400 max-w-sm">{error}</p>
            <button
              onClick={() => setPhase('setup')}
              className="text-xs px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700"
            >
              Try again
            </button>
          </div>
        )}

        {phase === 'results' && (
          <div className="flex flex-col gap-5">
            <p className="text-[11px] text-gray-500 -mt-1">
              {fileName(scan.path)} · {people.length} {people.length === 1 ? 'person' : 'people'},
              most-seen first. Click a frame to see it large.
            </p>
            {error && <p className="text-xs text-red-400">{error}</p>}
            {people.map((person, personIndex) => (
              <section key={personIndex} className="flex flex-col gap-2">
                <h3 className="text-xs font-bold text-gray-300">
                  Person {personIndex + 1}{' '}
                  <span className="font-normal text-gray-500">· seen in {person.frameCount} frames</span>
                </h3>
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                  {person.frames.map((frame, frameIndex) => {
                    const assignedTo = project.speakers.filter(
                      (s) => assigned[s.id] === frame.timestampSeconds
                    )
                    return (
                      <button
                        key={frame.timestampSeconds}
                        onClick={() => setViewing({ personIndex, frameIndex })}
                        className={`group relative rounded-lg overflow-hidden border bg-gray-950 text-left ${
                          assignedTo.length ? 'border-emerald-500' : 'border-gray-800 hover:border-amber-500'
                        }`}
                        title="Click to view large"
                      >
                        <div className="aspect-square overflow-hidden">
                          <img
                            src={frame.image}
                            alt={`Person ${personIndex + 1} at ${formatTimestamp(frame.timestampSeconds)}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        </div>
                        <div className="flex justify-between px-1.5 py-1 text-[10px] font-mono text-gray-400">
                          <span>{formatTimestamp(frame.timestampSeconds)}</span>
                          {assignedTo.length > 0 && <span className="text-emerald-400">✓</span>}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {viewedFrame && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex flex-col items-center justify-center gap-4 p-6"
          onClick={() => setViewing(null)}
        >
          <div className="relative flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() =>
                setViewing((v) => ({
                  ...v,
                  frameIndex: (v.frameIndex - 1 + viewedFrames.length) % viewedFrames.length,
                }))
              }
              className="text-3xl text-gray-400 hover:text-white px-2"
              aria-label="Previous frame"
            >
              ‹
            </button>
            <img
              src={viewedFrame.image}
              alt={`Person ${viewing.personIndex + 1} at ${formatTimestamp(viewedFrame.timestampSeconds)}`}
              className="max-h-[70vh] max-w-[75vw] rounded-lg shadow-2xl object-contain"
            />
            <button
              onClick={() =>
                setViewing((v) => ({ ...v, frameIndex: (v.frameIndex + 1) % viewedFrames.length }))
              }
              className="text-3xl text-gray-400 hover:text-white px-2"
              aria-label="Next frame"
            >
              ›
            </button>
          </div>
          <div className="flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
            <p className="text-xs text-gray-400 font-mono">
              Person {viewing.personIndex + 1} · {formatTimestamp(viewedFrame.timestampSeconds)} ·{' '}
              {viewing.frameIndex + 1}/{viewedFrames.length} · ← → to browse, Esc to close
            </p>
            {assignButtons(viewedFrame, 'lg')}
          </div>
        </div>
      )}
    </div>
  )
}

export default VideoScanModal
