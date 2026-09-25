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
  { id: 'rays', label: 'Light rays', defaults: { color: '#FFFFFF', opacity: 0.45, position: 'center' } },
  { id: 'speedLines', label: 'Speed lines', defaults: { color: '#FFFFFF', opacity: 0.9, position: 'center' } },
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
 * @typedef {{ offset: number, color: string, alpha?: number }} Stop
 * @typedef {{ type: 'linear', x0: number, y0: number, x1: number, y1: number, stops: Stop[] }
 *   | { type: 'radial', x: number, y: number, r0: number, r1: number, stops: Stop[] }} Gradient
 * @typedef {{ alpha: number, gradient?: Gradient, glow?: number, glowColor?: string,
 *   blend?: 'screen' | 'lighter' }} Paint
 * @typedef {(Paint & { kind: 'poly', points: Point[], fill: string })
 *   | (Paint & { kind: 'line', points: Point[], stroke: string, width: number })
 *   | (Paint & { kind: 'circle', x: number, y: number, r: number, fill: string })} DecorShape
 */

/**
 * Shapes to draw, back to front. Each is a polygon, a stroked polyline or a circle, painted
 * with a flat colour or `gradient`, optionally glowing (`glow` = blur px at 1280 × 720)
 * and blended with `screen` so light adds to the picture instead of pasting over it.
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

function hexToRgb(hex) {
  const value = String(hex || '#FFFFFF').replace('#', '')
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value.padEnd(6, '0')
  const n = parseInt(full.slice(0, 6), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Mixes `hex` towards `target` by t (0–1): towards white to light it, black to shade it. */
export function mixColor(hex, target, t) {
  const a = hexToRgb(hex)
  const b = hexToRgb(target)
  const mixed = a.map((v, i) => Math.round(v + (b[i] - v) * t))
  return `#${mixed.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

// Spotlight sunburst: beams in the chosen colour that fade out from a glowing centre.
function rays(el, rand, width, height) {
  const cx = anchorX(el.position, width)
  const cy = height * 0.5
  const count = 14
  const reach = Math.hypot(width, height) * 0.75
  const fade = {
    type: 'radial',
    x: cx,
    y: cy,
    r0: 0,
    r1: height * 0.8,
    stops: [
      { offset: 0, color: mixColor(el.color, '#FFFFFF', 0.3), alpha: 1 },
      { offset: 0.25, color: el.color, alpha: 0.8 },
      { offset: 0.7, color: el.color, alpha: 0.25 },
      { offset: 1, color: el.color, alpha: 0 },
    ],
  }
  const shapes = []
  const turn = rand() * Math.PI
  for (let i = 0; i < count; i++) {
    const a0 = turn + (i / count) * Math.PI * 2
    const a1 = a0 + (Math.PI / count) * (0.35 + rand() * 0.45)
    shapes.push({
      kind: 'poly',
      fill: el.color,
      gradient: fade,
      alpha: el.opacity,
      points: [
        { x: cx, y: cy },
        { x: cx + Math.cos(a0) * reach, y: cy + Math.sin(a0) * reach },
        { x: cx + Math.cos(a1) * reach, y: cy + Math.sin(a1) * reach },
      ],
    })
  }
  shapes.push({
    kind: 'circle',
    x: cx,
    y: cy,
    r: height * 0.45,
    fill: el.color,
    alpha: el.opacity,
    blend: 'screen',
    gradient: {
      type: 'radial',
      x: cx,
      y: cy,
      r0: 0,
      r1: height * 0.45,
      stops: [
        { offset: 0, color: mixColor(el.color, '#FFFFFF', 0.6), alpha: 0.7 },
        { offset: 1, color: el.color, alpha: 0 },
      ],
    },
  })
  return shapes
}

// Manga focus lines: thin streaks from the frame's edge that fade before a clear oval.
function speedLines(el, rand, width, height) {
  const cx = anchorX(el.position, width)
  const cy = height * 0.5
  const rx = width * 0.4
  const ry = height * 0.42
  const reach = Math.hypot(width, height)
  const shapes = []
  const count = 110
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + (rand() - 0.5) * 0.04
    const inner = 1 + rand() * 0.45
    const tip = { x: cx + Math.cos(angle) * rx * inner, y: cy + Math.sin(angle) * ry * inner }
    const outer = { x: cx + Math.cos(angle) * reach, y: cy + Math.sin(angle) * reach }
    const halfWidth = 0.003 + Math.pow(rand(), 2) * 0.014
    shapes.push({
      kind: 'poly',
      fill: el.color,
      alpha: el.opacity,
      gradient: {
        type: 'linear',
        x0: tip.x,
        y0: tip.y,
        x1: tip.x + (outer.x - tip.x) * 0.25,
        y1: tip.y + (outer.y - tip.y) * 0.25,
        stops: [
          { offset: 0, color: el.color, alpha: 0 },
          { offset: 1, color: el.color, alpha: 1 },
        ],
      },
      points: [
        tip,
        { x: cx + Math.cos(angle - halfWidth) * reach, y: cy + Math.sin(angle - halfWidth) * reach },
        { x: cx + Math.cos(angle + halfWidth) * reach, y: cy + Math.sin(angle + halfWidth) * reach },
      ],
    })
  }
  return shapes
}

// Neon growth chart: faint grid, fading bars and area, a glowing line with a hot core.
function chart(el, rand, width, height) {
  const w = width * 0.4
  const h = height * 0.46
  const left = el.position === 'left' ? width * 0.04 : el.position === 'center' ? (width - w) / 2 : width * 0.56
  const bottom = height * 0.9
  const top = bottom - h
  const hot = mixColor(el.color, '#FFFFFF', 0.65)
  const shapes = []
  for (let i = 1; i <= 3; i++) {
    const y = bottom - (h * i) / 3.2
    shapes.push({ kind: 'line', stroke: el.color, width: 1, alpha: el.opacity * 0.18, points: [{ x: left, y }, { x: left + w, y }] })
  }
  const points = 8
  const values = []
  let value = 0.1
  for (let i = 0; i < points; i++) {
    value += 0.05 + rand() * 0.12 - (i > 1 && rand() < 0.3 ? 0.14 : 0)
    value = Math.min(0.85, Math.max(0.06, value))
    values.push(i === points - 1 ? 1 : value)
  }
  const step = w / (points - 1)
  const line = values.map((v, i) => ({ x: left + i * step, y: bottom - v * h }))
  const barFade = {
    type: 'linear',
    x0: 0,
    y0: top,
    x1: 0,
    y1: bottom,
    stops: [
      { offset: 0, color: el.color, alpha: 0.55 },
      { offset: 1, color: el.color, alpha: 0 },
    ],
  }
  line.forEach((p, i) => {
    if (i === 0) return
    const barWidth = step * 0.34
    shapes.push({
      kind: 'poly',
      fill: el.color,
      gradient: barFade,
      alpha: el.opacity * 0.6,
      points: [
        { x: p.x - barWidth / 2, y: bottom },
        { x: p.x - barWidth / 2, y: p.y + 18 },
        { x: p.x + barWidth / 2, y: p.y + 18 },
        { x: p.x + barWidth / 2, y: bottom },
      ],
    })
  })
  shapes.push({
    kind: 'poly',
    fill: el.color,
    gradient: barFade,
    alpha: el.opacity * 0.5,
    points: [{ x: line[0].x, y: bottom }, ...line, { x: line[line.length - 1].x, y: bottom }],
  })
  const last = line[line.length - 1]
  const prev = line[line.length - 2]
  const angle = Math.atan2(last.y - prev.y, last.x - prev.x)
  const tip = { x: last.x + Math.cos(angle) * 40, y: last.y + Math.sin(angle) * 40 }
  // Normal blending: screen made the line vanish on light backgrounds of a similar hue.
  const glowing = { glow: 22, glowColor: el.color }
  shapes.push({ kind: 'line', stroke: el.color, width: 7, alpha: el.opacity, points: [...line, last], ...glowing })
  shapes.push({ kind: 'line', stroke: hot, width: 2.5, alpha: el.opacity, points: line })
  line.slice(1, -1).forEach((p) =>
    shapes.push({ kind: 'circle', x: p.x, y: p.y, r: 5, fill: hot, alpha: el.opacity, ...glowing })
  )
  shapes.push({ kind: 'poly', fill: el.color, alpha: el.opacity, points: arrowHead(prev, tip, 44), ...glowing })
  return shapes
}

// Chunky 3D zigzag arrow shooting up and to the right: a lit face over a shaded side.
function arrow(el, rand, width, height) {
  const startX = el.position === 'right' ? width * 0.5 : el.position === 'center' ? width * 0.28 : width * 0.04
  const span = width * 0.46
  const base = height * 0.95
  const points = [
    { x: startX, y: base },
    { x: startX + span * 0.32, y: base - height * (0.22 + rand() * 0.05) },
    { x: startX + span * 0.46, y: base - height * (0.13 + rand() * 0.04) },
    { x: startX + span * 0.86, y: base - height * 0.44 },
  ]
  const tip = { x: startX + span, y: base - height * 0.56 }
  const last = points[points.length - 1]
  const head = arrowHead(last, tip, 100)
  // Run the shaft well into the head so the two read as one piece.
  const heading = Math.atan2(tip.y - last.y, tip.x - last.x)
  points.push({ x: last.x + Math.cos(heading) * 30, y: last.y + Math.sin(heading) * 30 })
  const side = mixColor(mixColor(el.color, '#FF0040', 0.25), '#000000', 0.5)
  const depth = 14
  const shapes = []
  // The shaded side: the arrow repeated a pixel at a time down and to the right.
  for (let d = depth; d >= 1; d -= 1) {
    const shift = (p) => ({ x: p.x + d * 0.5, y: p.y + d })
    shapes.push({
      kind: 'line',
      stroke: side,
      width: 36,
      alpha: el.opacity,
      points: points.map(shift),
      ...(d === depth ? { glow: 30, glowColor: 'rgba(0,0,0,0.6)' } : {}),
    })
    shapes.push({ kind: 'poly', fill: side, alpha: el.opacity, points: head.map(shift) })
  }
  const face = {
    type: 'linear',
    x0: startX,
    y0: tip.y,
    x1: startX,
    y1: base,
    stops: [
      { offset: 0, color: mixColor(el.color, '#FFFFFF', 0.45) },
      { offset: 1, color: el.color },
    ],
  }
  shapes.push({ kind: 'line', stroke: el.color, width: 36, alpha: el.opacity, gradient: face, points })
  shapes.push({ kind: 'poly', fill: el.color, alpha: el.opacity, gradient: face, points: head })
  // A thin highlight along the top edge catches the light.
  shapes.push({
    kind: 'line',
    stroke: '#FFFFFF',
    width: 4,
    alpha: el.opacity * 0.55,
    points: points.slice(0, -1).map((p) => ({ x: p.x - 3, y: p.y - 13 })),
  })
  return shapes
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

// Comic halftone: dots shrinking and fading away from a corner.
function halftone(el, rand, width, height) {
  const cornerX = el.position === 'left' ? 0 : el.position === 'center' ? width / 2 : width
  const cornerY = el.position === 'center' ? height : 0
  const spacing = 22
  const reach = height * 0.8
  const shapes = []
  for (let y = spacing / 2; y < height; y += spacing) {
    for (let x = spacing / 2; x < width; x += spacing) {
      const offset = (Math.round(y / spacing) % 2) * (spacing / 2)
      const d = Math.hypot(x + offset - cornerX, y - cornerY)
      if (d > reach) continue
      const t = 1 - d / reach
      const r = (spacing / 2) * t * 0.9
      if (r < 0.8) continue
      shapes.push({ kind: 'circle', x: x + offset, y, r, fill: el.color, alpha: el.opacity * (0.35 + t * 0.65) })
    }
  }
  return shapes
}

// "///" marks: three slanted, glowing bars in a corner, and a smaller set opposite.
function slashes(el, rand, width, height) {
  const set = (x, y, size) =>
    [0, 1, 2].map((i) => {
      const x0 = x + i * size * 0.5
      return {
        kind: 'poly',
        fill: el.color,
        alpha: el.opacity * (1 - i * 0.2),
        glow: 16,
        glowColor: el.color,
        gradient: {
          type: 'linear',
          x0: x0,
          y0: y,
          x1: x0,
          y1: y + size,
          stops: [
            { offset: 0, color: mixColor(el.color, '#FFFFFF', 0.4) },
            { offset: 1, color: el.color },
          ],
        },
        points: [
          { x: x0 + size * 0.38, y },
          { x: x0 + size * 0.6, y },
          { x: x0 + size * 0.22, y: y + size },
          { x: x0, y: y + size },
        ],
      }
    })
  const big = 64 + rand() * 16
  const small = 40 + rand() * 10
  if (el.position === 'left') return [...set(width * 0.03, height * 0.05, big), ...set(width * 0.87, height * 0.85, small)]
  if (el.position === 'center') return [...set(width * 0.45, height * 0.04, big)]
  return [...set(width * 0.86, height * 0.05, big), ...set(width * 0.03, height * 0.85, small)]
}

// Lens-flare twinkles: a soft halo with a thin, bright four-point star, a few large, most small.
function sparkles(el, rand, width, height) {
  const count = 9
  const shapes = []
  const cx = anchorX(el.position, width)
  for (let i = 0; i < count; i++) {
    const x = Math.min(width - 20, Math.max(20, cx + (rand() - 0.5) * width * 0.8))
    const y = 30 + rand() * (height - 60)
    const size = 10 + Math.pow(rand(), 2.5) * 46
    shapes.push({
      kind: 'circle',
      x,
      y,
      r: size * 1.3,
      fill: el.color,
      alpha: el.opacity,
      blend: 'screen',
      gradient: {
        type: 'radial',
        x,
        y,
        r0: 0,
        r1: size * 1.3,
        stops: [
          { offset: 0, color: el.color, alpha: 0.55 },
          { offset: 1, color: el.color, alpha: 0 },
        ],
      },
    })
    const thin = size * 0.08
    shapes.push({
      kind: 'poly',
      fill: mixColor(el.color, '#FFFFFF', 0.8),
      alpha: el.opacity,
      glow: size * 0.5,
      glowColor: el.color,
      blend: 'screen',
      points: [
        { x, y: y - size },
        { x: x + thin, y: y - thin },
        { x: x + size * 0.7, y },
        { x: x + thin, y: y + thin },
        { x, y: y + size },
        { x: x - thin, y: y + thin },
        { x: x - size * 0.7, y },
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
