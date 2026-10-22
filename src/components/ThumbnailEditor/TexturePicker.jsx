import { useEffect, useRef, useState } from 'react'
import { listTextures, renderTexture } from '../../services/textures'
import { PROCGEN_STYLES, renderProcgen } from '../../modules/thumbnail/procgen'

const PREVIEW = { width: 320, height: 180 }
const FULL = { width: 1920, height: 1080 }

const randomSeed = () => Math.floor(Math.random() * 1_000_000)
const previewKey = (colors, seed) => `${colors.join()}|${seed}`

// Kept across mounts: the picker unmounts whenever another layer is selected, and
// re-rendering every preview each time Background was picked again froze the panel.
let remembered = null // { available, presets, colors, seed, previews, freshFor }

/**
 * Procedural backgrounds (always available, drawn in the browser) plus GPU textures from
 * the local engine (Core Image) when it is reachable. Previews re-render when the colours
 * or seed change; clicking one renders it at full size and sets it as the background
 * photo, so blur, darken and vignette work on it too.
 */
function TexturePicker({ initialColors, onPick }) {
  const [available, setAvailable] = useState(() => remembered?.available ?? null) // null = checking
  const [presets, setPresets] = useState(() => remembered?.presets ?? [])
  const styles = PROCGEN_STYLES
  const [colors, setColors] = useState(() => remembered?.colors ?? initialColors)
  const [seed, setSeed] = useState(() => remembered?.seed ?? randomSeed())
  const [previews, setPreviews] = useState(() => remembered?.previews ?? {})
  // Which colours+seed each preview was drawn with, so up-to-date ones aren't redrawn.
  const freshFor = useRef(remembered?.freshFor ?? {})
  const [picking, setPicking] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    remembered = { available, presets, colors, seed, previews, freshFor: freshFor.current }
  })

  const checkEngine = (quiet = false) => {
    if (!quiet) setAvailable(null)
    listTextures().then(({ textures, available: ok }) => {
      setPresets(textures)
      setAvailable(ok && textures.length > 0)
    })
  }

  // Quiet on remount, so a known engine state doesn't flash back to "checking".
  useEffect(() => checkEngine(remembered?.available != null), [])

  // Procedural previews are drawn in the browser, one per task so colour drags and clicks
  // stay responsive between them (a few take tens of milliseconds each).
  useEffect(() => {
    const key = previewKey(colors, seed)
    const todo = styles.filter((style) => freshFor.current[style.id] !== key)
    if (!todo.length) return undefined
    const drawNext = () => {
      const style = todo.shift()
      const image = renderProcgen(style.id, { colors, seed, ...PREVIEW })
      freshFor.current[style.id] = key
      setPreviews((prev) => ({ ...prev, [style.id]: image }))
      if (todo.length) timer = setTimeout(drawNext, 0)
    }
    let timer = setTimeout(drawNext, 120)
    return () => clearTimeout(timer)
  }, [styles, colors, seed])

  useEffect(() => {
    if (!available) return
    let cancelled = false
    const key = previewKey(colors, seed)
    // Wait briefly so dragging a colour picker doesn't fire a render per pixel.
    const timer = setTimeout(() => {
      presets
        .filter((preset) => freshFor.current[preset.id] !== key)
        .forEach((preset) => {
          renderTexture({ preset: preset.id, colors, seed, ...PREVIEW })
            .then((image) => {
              if (cancelled) return
              freshFor.current[preset.id] = key
              setPreviews((prev) => ({ ...prev, [preset.id]: image }))
            })
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
      const procedural = styles.some((style) => style.id === presetId)
      // Let "Rendering…" paint before the synchronous full-size draw blocks the thread.
      if (procedural) await new Promise((resolve) => setTimeout(resolve, 0))
      onPick(
        procedural
          ? renderProcgen(presetId, { colors, seed, ...FULL })
          : await renderTexture({ preset: presetId, colors, seed, ...FULL }),
      )
    } catch (err) {
      setError(err.message)
    } finally {
      setPicking(null)
    }
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
        {[...styles, ...(available ? presets : [])].map((preset) => (
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
      {available === false && (
        <p className="text-[10px] text-gray-500">
          More textures come from the YouThumber app&apos;s local engine, which isn&apos;t reachable here.{' '}
          <button onClick={() => checkEngine()} className="underline text-gray-300 hover:text-white">
            Try again
          </button>
        </p>
      )}
      {error && <p className="text-[10px] text-red-400">{error}</p>}
    </div>
  )
}

export default TexturePicker
