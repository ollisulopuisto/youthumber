/**
 * Headline effects: slant, 3D extrusion, gradient and accent-line colours, and a splash
 * shape behind the text. Pure geometry and style helpers; effectText.js draws them.
 * All shapes are in the text object's own coordinates: centred on (0, 0), `w` × `h`.
 */

export const SPLASH_STYLES = [
  { id: 'none', label: 'None' },
  { id: 'burst', label: 'Burst' },
  { id: 'splat', label: 'Splat' },
  { id: 'brush', label: 'Brush' },
]

export const ACCENT_LINE_MODES = [
  { id: 'none', label: 'None' },
  { id: 'first', label: 'First' },
  { id: 'last', label: 'Last' },
  { id: 'alternate', label: 'Every 2nd' },
]

/** Loud, saturated colours: they look garish on their own and pop on a thumbnail. */
export const LOUD_COLORS = [
  '#FFE600', '#FF9F00', '#FF3D00', '#FF1F6B', '#FF2EE6',
  '#9D4DFF', '#00E5FF', '#2979FF', '#76FF03', '#FFFFFF',
]

/** Small deterministic PRNG (mulberry32), so a splash keeps its shape between redraws. */
export function seededRandom(seed) {
  let a = (Number(seed) || 1) >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function newSplashSeed() {
  return Math.floor(Math.random() * 1_000_000) + 1
}

/** Fabric skewX for a slant in degrees. Positive slant leans forward, like italics. */
export function slantToSkewX(slant) {
  return -(slant || 0)
}

export function skewXToSlant(skewX) {
  return Math.round(-(skewX || 0)) || 0
}

/**
 * Offsets for each extrusion layer, back to front (deepest first). Angle is the direction
 * the depth goes, in degrees, 0 = right, 90 = down. One layer per pixel of depth, so the
 * side reads as solid rather than a stack of copies.
 */
export function extrusionOffsets(depth, angle = 45) {
  const steps = Math.max(0, Math.round(depth || 0))
  const rad = ((angle ?? 45) * Math.PI) / 180
  const dx = Math.cos(rad)
  const dy = Math.sin(rad)
  const offsets = []
  for (let i = steps; i >= 1; i--) {
    offsets.push({ x: dx * i, y: dy * i })
  }
  return offsets
}

/** Vertical two-colour gradient across the text box, as fabric.Gradient options. */
export function textGradientSpec(colors, height) {
  return {
    type: 'linear',
    gradientUnits: 'pixels',
    coords: { x1: 0, y1: 0, x2: 0, y2: Math.max(1, height) },
    colorStops: [
      { offset: 0, color: colors[0] },
      { offset: 1, color: colors[1] ?? colors[0] },
    ],
  }
}

/** Indices of the lines that get the accent colour. */
export function accentLineIndices(lineCount, mode) {
  if (!lineCount || !mode || mode === 'none') return []
  if (mode === 'first') return [0]
  if (mode === 'last') return [lineCount - 1]
  if (mode === 'alternate') {
    return Array.from({ length: lineCount }, (_, i) => i).filter((i) => i % 2 === 1)
  }
  return []
}

/**
 * Fabric per-character styles that paint the accent lines in `color`.
 * `lines` is the text split into lines, each an array of characters (graphemes).
 */
export function accentLineStyles(lines, mode, color) {
  const styles = {}
  if (!color) return styles
  for (const lineIndex of accentLineIndices(lines.length, mode)) {
    const chars = lines[lineIndex]
    if (!chars.length) continue
    styles[lineIndex] = {}
    chars.forEach((_, charIndex) => {
      styles[lineIndex][charIndex] = { fill: color }
    })
  }
  return styles
}

/**
 * @typedef {{ type: 'polygon', points: { x: number, y: number }[] }
 *   | { type: 'circle', x: number, y: number, r: number }} SplashShape
 */

/**
 * The splash as shapes to fill: `{ type: 'polygon', points }` or `{ type: 'circle', x, y, r }`.
 * `size` scales it relative to the text box (1 = hugging the text).
 * @returns {SplashShape[]}
 */
export function splashShapes(style, w, h, seed = 1, size = 1) {
  const rand = seededRandom(seed)
  const width = Math.max(1, w) * size
  const height = Math.max(1, h) * size
  if (style === 'burst') return [burstShape(rand, width, height)]
  if (style === 'splat') return splatShapes(rand, width, height)
  if (style === 'brush') return brushShapes(rand, width, height)
  return []
}

// Comic starburst: spikes alternating between an outer and inner ellipse.
function burstShape(rand, width, height) {
  const spikes = 16 + Math.floor(rand() * 8)
  const rx = width * 0.62
  const ry = height * 0.9
  const points = []
  for (let i = 0; i < spikes * 2; i++) {
    const angle = (i / (spikes * 2)) * Math.PI * 2 + rand() * 0.08
    const outer = i % 2 === 0
    const r = outer ? 1 + rand() * 0.22 : 0.72 + rand() * 0.08
    points.push({ x: Math.cos(angle) * rx * r, y: Math.sin(angle) * ry * r })
  }
  return { type: 'polygon', points }
}

// Paint splat: a lumpy blob with a few long streaks, and droplets flung around it.
function splatShapes(rand, width, height) {
  const rx = width * 0.55
  const ry = height * 0.75
  const count = 64
  const streaks = new Set(Array.from({ length: 5 }, () => Math.floor(rand() * count)))
  const points = []
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2
    let r = 0.9 + Math.sin(angle * 3 + rand()) * 0.05 + rand() * 0.1
    if (streaks.has(i)) r += 0.35 + rand() * 0.35
    points.push({ x: Math.cos(angle) * rx * r, y: Math.sin(angle) * ry * r })
  }
  const shapes = [{ type: 'polygon', points }]
  const drops = 9 + Math.floor(rand() * 6)
  for (let i = 0; i < drops; i++) {
    const angle = rand() * Math.PI * 2
    const distance = 1.1 + rand() * 0.45
    shapes.push({
      type: 'circle',
      x: Math.cos(angle) * rx * distance,
      y: Math.sin(angle) * ry * distance,
      r: Math.max(2, Math.min(width, height) * (0.02 + rand() * 0.06)),
    })
  }
  return shapes
}

// Brush stroke: a wide band with ragged ends and a slight wobble, plus two thin streaks.
function brushShapes(rand, width, height) {
  const halfW = width * 0.58
  const halfH = height * 0.62
  const top = []
  const bottom = []
  const steps = 24
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const x = -halfW + t * halfW * 2
    top.push({ x, y: -halfH + (rand() - 0.5) * halfH * 0.12 })
    bottom.push({ x, y: halfH + (rand() - 0.5) * halfH * 0.12 })
  }
  const raggedEnd = (xEdge, direction) => {
    const points = []
    const teeth = 7
    for (let i = 0; i <= teeth; i++) {
      const y = halfH - (i / teeth) * halfH * 2
      const bite = (i % 2 === 0 ? rand() * 0.12 : 0.1 + rand() * 0.2) * halfW
      points.push({ x: xEdge + direction * bite, y })
    }
    return points
  }
  const band = [
    ...top,
    ...raggedEnd(halfW, 1).reverse(),
    ...bottom.reverse(),
    ...raggedEnd(-halfW, -1),
  ]
  const streak = (y, thickness, start, end) => [
    { x: -halfW * start, y: y - thickness },
    { x: halfW * end, y: y - thickness * 0.4 },
    { x: halfW * end, y: y + thickness * 0.4 },
    { x: -halfW * start, y: y + thickness },
  ]
  return [
    { type: 'polygon', points: band },
    { type: 'polygon', points: streak(-halfH * 1.18, halfH * 0.05, 0.9, 0.5 + rand() * 0.4) },
    { type: 'polygon', points: streak(halfH * 1.2, halfH * 0.04, 0.4 + rand() * 0.4, 1.05) },
  ]
}
