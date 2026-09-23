import { useEffect, useState } from 'react'
import { listTextures, renderTexture } from '../../services/textures'

const PREVIEW = { width: 320, height: 180 }
const FULL = { width: 1920, height: 1080 }

const randomSeed = () => Math.floor(Math.random() * 1_000_000)

/**
 * GPU textures from the local engine (Core Image). Previews re-render when the colours
 * or seed change; clicking one renders it at full size and sets it as the background
 * photo, so blur, darken and vignette work on it too.
 */
function TexturePicker({ initialColors, onPick }) {
  const [available, setAvailable] = useState(null) // null = checking
  const [presets, setPresets] = useState([])
  const [colors, setColors] = useState(initialColors)
  const [seed, setSeed] = useState(randomSeed)
  const [previews, setPreviews] = useState({})
  const [picking, setPicking] = useState(null)
  const [error, setError] = useState(null)

  const checkEngine = () => {
    setAvailable(null)
    listTextures().then(({ textures, available: ok }) => {
      setPresets(textures)
      setAvailable(ok && textures.length > 0)
    })
  }

  useEffect(checkEngine, [])

  useEffect(() => {
    if (!available) return
    let cancelled = false
    // Wait briefly so dragging a colour picker doesn't fire a render per pixel.
    const timer = setTimeout(() => {
      presets.forEach((preset) => {
        renderTexture({ preset: preset.id, colors, seed, ...PREVIEW })
          .then((image) => !cancelled && setPreviews((prev) => ({ ...prev, [preset.id]: image })))
          .catch((err) => !cancelled && setError(err.message))
      })
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [available, presets, colors, seed])

  const pick = async (presetId) => {
    setPicking(presetId)
    setError(null)
    try {
      onPick(await renderTexture({ preset: presetId, colors, seed, ...FULL }))
    } catch (err) {
      setError(err.message)
    } finally {
      setPicking(null)
    }
  }

  if (available === null) return <p className="text-[10px] text-gray-500">Checking texture engine…</p>
  if (!available) {
    return (
      <p className="text-[10px] text-gray-500">
        Textures are made by the YouThumber app&apos;s local engine, which isn&apos;t reachable
        here.{' '}
        <button onClick={checkEngine} className="underline text-gray-300 hover:text-white">
          Try again
        </button>
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {[0, 1].map((i) => (
          <input
            key={i}
            type="color"
            aria-label={`Texture colour ${i + 1}`}
            value={colors[i]}
            onChange={(e) => setColors((prev) => prev.map((c, j) => (j === i ? e.target.value : c)))}
            className="w-8 h-8 rounded border border-gray-700 cursor-pointer bg-transparent"
          />
        ))}
        <button
          onClick={() => setSeed(randomSeed())}
          className="text-[10px] px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700"
          title="New random variation of every texture"
        >
          🎲 Shuffle
        </button>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {presets.map((preset) => (
          <button
            key={preset.id}
            onClick={() => pick(preset.id)}
            disabled={picking !== null}
            className="relative aspect-video rounded overflow-hidden border border-gray-700/80 hover:border-emerald-400 bg-gray-950 disabled:opacity-60"
            title={preset.name}
            aria-label={`${preset.name} texture`}
          >
            {previews[preset.id] && (
              <img src={previews[preset.id]} alt="" className="w-full h-full object-cover" />
            )}
            <span className="absolute bottom-0 inset-x-0 bg-black/60 text-[9px] text-gray-200 px-1 truncate">
              {picking === preset.id ? 'Rendering…' : preset.name}
            </span>
          </button>
        ))}
      </div>
      {error && <p className="text-[10px] text-red-400">{error}</p>}
    </div>
  )
}

export default TexturePicker
