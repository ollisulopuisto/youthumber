/**
 * The Graphics layer: loud decorations drawn over the background (or anywhere in the
 * layer stack): light rays, manga speed lines, a rising chart, a zigzag arrow, halftone
 * dots, slash marks and sparkles. Pure geometry here; decorObject.js draws it.
 * Everything is in canvas pixels (1280 × 720) and seeded, so it keeps its shape.
 */
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './canvasSize'
import { seededRandom } from './textEffects'

export const DECOR_LAYER_ID = 'decor'

/** Menu order. `defaults` are what a newly switched-on element starts with. */
export const DECOR_ELEMENTS = [
  { id: 'rays', label: 'Light rays', defaults: { color: '#FFE600', opacity: 0.35, position: 'center' } },
  { id: 'speedLines', label: 'Speed lines', defaults: { color: '#FFFFFF', opacity: 0.6, position: 'center' } },
  { id: 'chart', label: 'Rising chart', defaults: { color: '#00E5FF', opacity: 0.85, position: 'right' } },
  { id: 'arrow', label: 'Big arrow', defaults: { color: '#FFE600', opacity: 1, position: 'left' } },
  { id: 'halftone', label: 'Halftone', defaults: { color: '#FF1F6B', opacity: 0.7, position: 'right' } },
  { id: 'slashes', label: 'Slashes', defaults: { color: '#FFE600', opacity: 1, position: 'right' } },
  { id: 'sparkles', label: 'Sparkles', defaults: { color: '#FFFFFF', opacity: 0.9, position: 'center' } },
]

export const DECOR_POSITIONS = [
  { id: 'left', label: 'Left' },
  { id: 'center', label: 'Centre' },
  { id: 'right', label: 'Right' },
]

export function defaultDecor() {
  return { visible: true, seed: 1, elements: {} }
}

/** The element's settings with its defaults filled in, or null when it's off. */
export function decorElement(decor, id) {
  const element = decor?.elements?.[id]
  if (!element?.on) return null
  const spec = DECOR_ELEMENTS.find((e) => e.id === id)
  return { ...spec?.defaults, ...element }
}

export function hasDecor(decor) {
  return !!decor?.visible && DECOR_ELEMENTS.some((e) => decorElement(decor, e.id))
}

/**
 * The layer order with the Graphics layer in it. Projects saved before it existed don't
 * list it; it then sits just above the background.
 */
export function withDecorLayer(layerOrder) {
  if (layerOrder.includes(DECOR_LAYER_ID)) return layerOrder
  const at = layerOrder.indexOf('background') + 1
  return [...layerOrder.slice(0, at), DECOR_LAYER_ID, ...layerOrder.slice(at)]
}

/**
 * @typedef {{ x: number, y: number }} Point
 * @typedef {{ kind: 'poly', points: Point[], fill: string, alpha: number }
 *   | { kind: 'line', points: Point[], stroke: string, width: number, alpha: number }
 *   | { kind: 'circle', x: number, y: number, r: number, fill: string, alpha: number }} DecorShape
 */

/**
 * Shapes to draw, back to front:
 *   { kind: 'poly', points, fill, alpha }
 *   { kind: 'line', points, stroke, width, alpha }
 *   { kind: 'circle', x, y, r, fill, alpha }
 */
/** @returns {DecorShape[]} */
export function decorShapes(decor, width = CANVAS_WIDTH, height = CANVAS_HEIGHT) {
  if (!decor?.visible) return []
  const shapes = []
  DECOR_ELEMENTS.forEach((spec, index) => {
    const element = decorElement(decor, spec.id)
    if (!element) return
    // Each element gets its own stream, so switching one on doesn't reshape the others.
    const rand = seededRandom((decor.seed || 1) * 31 + index)
    shapes.push(...BUILDERS[spec.id](element, rand, width, height))
  })
  return shapes
}

function anchorX(position, width) {
  if (position === 'left') return width * 0.25
  if (position === 'right') return width * 0.75
  return width * 0.5
}

// Alternating wedges fanning out from a point, like a spotlight sunburst.
function rays(el, rand, width, height) {
  const cx = anchorX(el.position, width)
  const cy = height * 0.55
  const count = 18
  const reach = Math.hypot(width, height)
  const shapes = []
  const turn = rand() * Math.PI
  for (let i = 0; i < count; i++) {
    const a0 = turn + (i / count) * Math.PI * 2
    const a1 = a0 + (Math.PI / count) * (0.7 + rand() * 0.5)
    shapes.push({
      kind: 'poly',
      fill: el.color,
      alpha: el.opacity,
      points: [
        { x: cx, y: cy },
        { x: cx + Math.cos(a0) * reach, y: cy + Math.sin(a0) * reach },
        { x: cx + Math.cos(a1) * reach, y: cy + Math.sin(a1) * reach },
      ],
    })
  }
  return shapes
}

// Manga focus lines: thin spikes from outside the frame towards a clear oval.
function speedLines(el, rand, width, height) {
  const cx = anchorX(el.position, width)
  const cy = height * 0.5
  const rx = width * 0.36
  const ry = height * 0.4
  const reach = Math.hypot(width, height)
  const shapes = []
  const count = 90
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + rand() * 0.05
    const inner = 1 + rand() * 0.35
    const tip = { x: cx + Math.cos(angle) * rx * inner, y: cy + Math.sin(angle) * ry * inner }
    const halfWidth = 0.004 + rand() * 0.012
    shapes.push({
      kind: 'poly',
      fill: el.color,
      alpha: el.opacity,
      points: [
        tip,
        { x: cx + Math.cos(angle - halfWidth) * reach, y: cy + Math.sin(angle - halfWidth) * reach },
        { x: cx + Math.cos(angle + halfWidth) * reach, y: cy + Math.sin(angle + halfWidth) * reach },
      ],
    })
  }
  return shapes
}

// HUD-style growth chart: faint grid, rising bars, a glowing line ending in an arrowhead.
function chart(el, rand, width, height) {
  const w = width * 0.42
  const h = height * 0.5
  const left = el.position === 'left' ? width * 0.03 : el.position === 'center' ? (width - w) / 2 : width * 0.55
  const bottom = height * 0.92
  const shapes = []
  for (let i = 0; i <= 4; i++) {
    const y = bottom - (h * i) / 4
    shapes.push({ kind: 'line', stroke: el.color, width: 1.5, alpha: el.opacity * 0.25, points: [{ x: left, y }, { x: left + w, y }] })
  }
  const bars = 9
  const step = w / bars
  const values = []
  let value = 0.12
  for (let i = 0; i < bars; i++) {
    value = Math.min(1, value + 0.04 + rand() * 0.14 - (rand() < 0.25 ? 0.12 : 0))
    value = Math.max(0.08, value)
    values.push(i === bars - 1 ? Math.max(value, 0.95) : value)
  }
  values.forEach((v, i) => {
    const x = left + i * step + step * 0.18
    const barWidth = step * 0.64
    shapes.push({
      kind: 'poly',
      fill: el.color,
      alpha: el.opacity * 0.35,
      points: [
        { x, y: bottom },
        { x, y: bottom - v * h * 0.8 },
        { x: x + barWidth, y: bottom - v * h * 0.8 },
        { x: x + barWidth, y: bottom },
      ],
    })
  })
  const line = values.map((v, i) => ({ x: left + (i + 0.5) * step, y: bottom - v * h }))
  shapes.push({ kind: 'line', stroke: el.color, width: 16, alpha: el.opacity * 0.25, points: line })
  shapes.push({ kind: 'line', stroke: el.color, width: 6, alpha: el.opacity, points: line })
  line.slice(0, -1).forEach((p) => shapes.push({ kind: 'circle', x: p.x, y: p.y, r: 6, fill: el.color, alpha: el.opacity }))
  shapes.push({ kind: 'poly', fill: el.color, alpha: el.opacity, points: arrowHead(line[line.length - 2], line[line.length - 1], 34) })
  return shapes
}

// Chunky zigzag arrow shooting up and to the right, with a dark outline.
function arrow(el, rand, width, height) {
  const startX = el.position === 'right' ? width * 0.5 : el.position === 'center' ? width * 0.28 : width * 0.04
  const span = width * 0.46
  const base = height * 0.95
  const points = [
    { x: startX, y: base },
    { x: startX + span * 0.3, y: base - height * (0.2 + rand() * 0.06) },
    { x: startX + span * 0.46, y: base - height * (0.12 + rand() * 0.05) },
    { x: startX + span * 0.9, y: base - height * 0.45 },
  ]
  const tip = { x: startX + span, y: base - height * 0.53 }
  const last = points[points.length - 1]
  const head = arrowHead(last, tip, 90)
  // The outline head is the same triangle grown by ~14px on every side.
  const angle = Math.atan2(tip.y - last.y, tip.x - last.x)
  const outlineTip = { x: tip.x + Math.cos(angle) * 16, y: tip.y + Math.sin(angle) * 16 }
  return [
    { kind: 'line', stroke: '#000000', width: 50, alpha: el.opacity * 0.85, points },
    { kind: 'poly', fill: '#000000', alpha: el.opacity * 0.85, points: arrowHead(last, outlineTip, 120) },
    { kind: 'line', stroke: el.color, width: 34, alpha: el.opacity, points },
    { kind: 'poly', fill: el.color, alpha: el.opacity, points: head },
  ]
}

/** A triangle pointing from `from` to `to`, with its tip at `to`. */
export function arrowHead(from, to, size) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x)
  const back = { x: to.x - Math.cos(angle) * size, y: to.y - Math.sin(angle) * size }
  const side = size * 0.6
  return [
    to,
    { x: back.x + Math.cos(angle + Math.PI / 2) * side, y: back.y + Math.sin(angle + Math.PI / 2) * side },
    { x: back.x + Math.cos(angle - Math.PI / 2) * side, y: back.y + Math.sin(angle - Math.PI / 2) * side },
  ]
}

// Comic halftone: dots shrinking away from a corner.
function halftone(el, rand, width, height) {
  const cornerX = el.position === 'left' ? 0 : el.position === 'center' ? width / 2 : width
  const cornerY = el.position === 'center' ? height : 0
  const spacing = 26
  const reach = height * 0.85
  const shapes = []
  for (let y = spacing / 2; y < height; y += spacing) {
    for (let x = spacing / 2; x < width; x += spacing) {
      const offset = (Math.round(y / spacing) % 2) * (spacing / 2)
      const d = Math.hypot(x + offset - cornerX, y - cornerY)
      if (d > reach) continue
      const r = (spacing / 2) * (1 - d / reach) * 0.95
      if (r < 1) continue
      shapes.push({ kind: 'circle', x: x + offset, y, r, fill: el.color, alpha: el.opacity })
    }
  }
  return shapes
}

// "///" marks: three slanted bars in a corner, and a smaller set in the opposite one.
function slashes(el, rand, width, height) {
  const set = (x, y, size) =>
    [0, 1, 2].map((i) => {
      const x0 = x + i * size * 0.55
      return {
        kind: 'poly',
        fill: el.color,
        alpha: el.opacity,
        points: [
          { x: x0 + size * 0.35, y },
          { x: x0 + size * 0.65, y },
          { x: x0 + size * 0.3, y: y + size },
          { x: x0, y: y + size },
        ],
      }
    })
  const big = 70 + rand() * 20
  const small = 44 + rand() * 12
  if (el.position === 'left') return [...set(width * 0.03, height * 0.05, big), ...set(width * 0.86, height * 0.84, small)]
  if (el.position === 'center') return [...set(width * 0.44, height * 0.04, big)]
  return [...set(width * 0.86, height * 0.05, big), ...set(width * 0.03, height * 0.84, small)]
}

// Four-point twinkles scattered around, bigger ones fewer.
function sparkles(el, rand, width, height) {
  const count = 14
  const shapes = []
  const cx = anchorX(el.position, width)
  for (let i = 0; i < count; i++) {
    const x = Math.min(width, Math.max(0, cx + (rand() - 0.5) * width * 0.9))
    const y = rand() * height
    const size = 8 + Math.pow(rand(), 3) * 38
    const thin = size * 0.22
    shapes.push({
      kind: 'poly',
      fill: el.color,
      alpha: el.opacity,
      points: [
        { x, y: y - size },
        { x: x + thin, y: y - thin },
        { x: x + size, y },
        { x: x + thin, y: y + thin },
        { x, y: y + size },
        { x: x - thin, y: y + thin },
        { x: x - size, y },
        { x: x - thin, y: y - thin },
      ],
    })
  }
  return shapes
}

const BUILDERS = { rays, speedLines, chart, arrow, halftone, slashes, sparkles }

/**
 * A random loud combination: two to four elements in clashing colours.
 * @returns {import('../../types/thumbnail').DecorState}
 */
export function randomDecor(colors, random = Math.random) {
  const pick = (list) => list[Math.floor(random() * list.length)]
  const ids = DECOR_ELEMENTS.map((e) => e.id).sort(() => random() - 0.5)
  const count = 2 + Math.floor(random() * 3)
  // Every element is listed, so the ones not picked are switched off.
  const elements = Object.fromEntries(ids.map((id) => [id, { on: false }]))
  for (const id of ids.slice(0, count)) {
    const spec = DECOR_ELEMENTS.find((e) => e.id === id)
    elements[id] = {
      ...spec.defaults,
      on: true,
      color: pick(colors),
      position: pick(DECOR_POSITIONS).id,
    }
  }
  return { visible: true, seed: Math.floor(random() * 1_000_000) + 1, elements }
}
