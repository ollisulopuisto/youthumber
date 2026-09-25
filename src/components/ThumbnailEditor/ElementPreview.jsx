import { findElement } from '../../data/elements'

const SLOT_DEFAULTS = { ink: '#111111', paper: '#FFFFFF' }

/** A library element drawn as inline SVG, for the picker and the properties header. */
function ElementPreview({ elementId, colors, text, className = 'w-full h-full' }) {
  const spec = findElement(elementId)
  if (!spec) return null
  const [w, h] = spec.viewBox
  const palette = { ...SLOT_DEFAULTS, ...spec.colors, ...(colors ?? {}) }
  const paint = (slot) => (slot ? (palette[slot] ?? slot) : 'none')

  return (
    <svg viewBox={`-6 -6 ${w + 12} ${h + 12}`} className={className} aria-hidden="true">
      {spec.parts.map((part, i) => {
        const common = {
          fill: paint(part.fill),
          stroke: paint(part.stroke),
          strokeWidth: part.width || 0,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }
        if (part.circle) {
          const [cx, cy, r] = part.circle
          return <circle key={i} cx={cx} cy={cy} r={r} {...common} />
        }
        if (part.text !== undefined) {
          const label = part.label ? (text ?? spec.text ?? part.text) : part.text
          return (
            <text
              key={i}
              x={part.x}
              y={part.y}
              fontSize={part.size}
              fontFamily={part.font}
              textAnchor="middle"
              paintOrder="stroke"
              strokeWidth={(part.width || 0) * 2}
              fill={paint(part.fill)}
              stroke={paint(part.stroke)}
              transform={part.rotate ? `rotate(${part.rotate} ${part.x} ${part.y})` : undefined}
            >
              {label}
            </text>
          )
        }
        return <path key={i} d={part.d} {...common} />
      })}
    </svg>
  )
}

export default ElementPreview
