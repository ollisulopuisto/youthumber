import { useEffect, useState } from 'react'
import { fetchMattingModel, startMattingDownload } from '../../services/mattingModel'

/**
 * Offers the engine's sharper-edges model (BiRefNet) and shows its download progress.
 * Renders nothing without the local engine, and a short note once the model is ready.
 */
function MattingModelBanner() {
  const [model, setModel] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetchMattingModel().then((state) => !cancelled && setModel(state))
    return () => {
      cancelled = true
    }
  }, [])

  const downloading = model?.status === 'downloading'
  useEffect(() => {
    if (!downloading) return undefined
    const timer = setInterval(async () => {
      const state = await fetchMattingModel()
      if (state) setModel(state)
    }, 1000)
    return () => clearInterval(timer)
  }, [downloading])

  if (!model) return <span />

  const download = async () => {
    setError(null)
    try {
      setModel(await startMattingDownload())
    } catch (err) {
      setError(err.message)
    }
  }

  if (model.status === 'ready') {
    return <span className="text-[11px] text-emerald-400">✓ Sharp edges (BiRefNet) on</span>
  }

  if (downloading) {
    const percent = Math.round((model.progress ?? 0) * 100)
    return (
      <div className="flex items-center gap-2 text-[11px] text-gray-300">
        <span>Downloading sharp-edges model…</span>
        <div
          className="w-32 h-1.5 bg-gray-800 rounded-full overflow-hidden"
          role="progressbar"
          aria-label="Model download progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <div className="h-full bg-sky-500" style={{ width: `${percent}%` }} />
        </div>
        <span className="tabular-nums">{percent}%</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 text-[11px]">
      <button
        onClick={download}
        className="px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-sky-300 border border-gray-700 transition-colors"
        title="BiRefNet: Pixelcut-quality edges on hands and hair. One-time download."
      >
        ✨ Get sharper cutout edges ({model.sizeMb} MB download)
      </button>
      {(model.status === 'error' || error) && (
        <span className="text-red-400">{error || model.error}</span>
      )}
    </div>
  )
}

export default MattingModelBanner
