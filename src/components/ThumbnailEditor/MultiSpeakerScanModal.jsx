import { useEffect, useState } from 'react'
import {
  pickVideoFile,
  scanVideoForSpeakers,
  grabFullResolutionFrame,
} from '../../services/videoScan'

const SLOT_LABELS = {
  speaker1: 'Speaker 1',
  speaker2: 'Speaker 2',
}

function formatTimestamp(seconds) {
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function MultiSpeakerScanModal({ onClose, onAssign }) {
  const [phase, setPhase] = useState('picking') // picking | scanning | results | error
  const [videoPath, setVideoPath] = useState(null)
  const [people, setPeople] = useState([])
  const [error, setError] = useState(null)
  const [assignments, setAssignments] = useState({ speaker1: null, speaker2: null }) // slotId -> personIndex
  const [pendingSlot, setPendingSlot] = useState(null) // slotId currently being grabbed, for a per-button spinner

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

        const result = await scanVideoForSpeakers(path)
        if (cancelled) return

        if (!result.length) {
          setError(
            'No clear, well-framed faces were found in this video. It may be too dark, too zoomed out, or people are rarely on camera.'
          )
          setPhase('error')
          return
        }
        setPeople(result)
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

  const handleAssign = async (personIndex, slotId) => {
    setPendingSlot(slotId)
    try {
      const person = people[personIndex]
      const fullResUrl = await grabFullResolutionFrame(videoPath, person.timestampSeconds)
      onAssign(slotId, fullResUrl)
      setAssignments((prev) => ({ ...prev, [slotId]: personIndex }))
    } catch (err) {
      setError(err.message)
      setPhase('error')
    } finally {
      setPendingSlot(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-y-auto p-5 shadow-2xl flex flex-col gap-4 text-white">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-200 flex items-center gap-1.5">
            🎬 Scan Video for All Speakers
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 text-xs font-medium"
          >
            ✕ Close
          </button>
        </div>

        {(phase === 'picking' || phase === 'scanning') && (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <div className="w-8 h-8 border-2 border-gray-700 border-t-amber-500 rounded-full animate-spin" />
            <p className="text-xs text-gray-400">
              {phase === 'picking' && 'Waiting for file selection…'}
              {phase === 'scanning' &&
                'Scanning video, detecting every face, and grouping them by identity with Apple Vision — this can take a moment for long recordings…'}
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
              Found {people.length} distinct {people.length === 1 ? 'person' : 'people'}, ranked
              by how often each appears. Assign each one to a speaker slot.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {people.map((person, index) => {
                const assignedSlot = Object.entries(assignments).find(
                  ([, personIdx]) => personIdx === index
                )?.[0]

                return (
                  <div
                    key={index}
                    className={`flex flex-col gap-2 rounded-lg overflow-hidden border p-2 bg-gray-950 ${
                      assignedSlot ? 'border-emerald-500' : 'border-gray-800'
                    }`}
                  >
                    <div className="aspect-square overflow-hidden rounded bg-gray-900">
                      <img
                        src={person.image}
                        alt={`Person ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono">
                      <span>{formatTimestamp(person.timestampSeconds)}</span>
                      <span title="Appears in this many sampled frames">
                        seen ×{person.frameCount}
                      </span>
                    </div>

                    {assignedSlot ? (
                      <div className="text-[11px] text-emerald-400 font-medium text-center py-1">
                        ✓ Assigned to {SLOT_LABELS[assignedSlot]}
                      </div>
                    ) : (
                      <div className="flex gap-1.5">
                        {['speaker1', 'speaker2'].map((slotId) => (
                          <button
                            key={slotId}
                            onClick={() => handleAssign(index, slotId)}
                            disabled={pendingSlot !== null}
                            className="flex-1 text-[11px] py-1 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-200 border border-gray-700 transition-colors"
                          >
                            {pendingSlot === slotId ? '…' : `→ ${SLOT_LABELS[slotId]}`}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default MultiSpeakerScanModal
