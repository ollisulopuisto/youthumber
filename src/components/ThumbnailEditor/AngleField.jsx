import { useState } from 'react'

/**
 * Degrees as a text-edited number. It keeps what is typed ("-", "-4") until it parses, so a
 * minus sign can be entered first; a valid number is clamped to -180..180 and passed on.
 */
function AngleField({ value, onChange, label }) {
  const [draft, setDraft] = useState(null)
  return (
    <input
      type="text"
      inputMode="numeric"
      aria-label={label}
      value={draft ?? String(value)}
      onChange={(e) => {
        const text = e.target.value
        setDraft(text)
        const parsed = Number(text)
        if (text.trim() !== '' && Number.isFinite(parsed)) {
          onChange(Math.max(-180, Math.min(180, Math.round(parsed))))
        }
      }}
      onBlur={() => setDraft(null)}
      className="w-16 bg-gray-950 border border-gray-700 rounded px-1.5 py-0.5 text-gray-200 font-mono text-[11px]"
    />
  )
}

export default AngleField
