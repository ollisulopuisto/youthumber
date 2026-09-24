/**
 * Vector elements the user can drop onto a thumbnail (stickers). Each is a small drawing in
 * its own `viewBox`, made of parts. A part is a path (`d`), a circle or a text label, and
 * is painted from colour slots rather than fixed colours, so every element recolours:
 *   primary / accent: the element's two editable colours
 *   ink: near-black, for outlines and marks
 *   paper: white
 * `width` is a part's stroke width in viewBox units; the element's Line weight scales it.
 * A part with `label: true` shows the element's editable text instead of its own.
 * A text part's `maxWidth` (viewBox units) squeezes longer text to fit.
 *
 * `fit` says how the element goes with the headline (see modules/thumbnail/elementFit.js):
 *   behind: stretched to the headline's box plus `pad`, drawn under the text
 *   around: stretched round the headline, drawn over it
 *   under: as wide as the headline, just below it
 *   corner / side / sideLeft: sized to the text height, at its top-right corner,
 *     right end or bottom-left
 * `pad` is [x, y] as fractions of the headline's height.
 *
 * To add an element: append it here. The picker, canvas and properties need no changes.
 */

export const ELEMENT_CATEGORIES = [
  { id: 'headline', name: 'With the headline' },
  { id: 'reaction', name: 'Reactions' },
  { id: 'versus', name: 'Debate' },
  { id: 'podcast', name: 'Podcast' },
]

const BOLD_FONT = 'Anton, Impact, "Arial Black", sans-serif'

// Audio waveform: mirrored bars of varying height, as one stroked path.
function waveformPath() {
  const heights = [8, 14, 22, 12, 30, 44, 26, 38, 52, 34, 20, 46, 28, 16, 36, 24, 12, 18, 9, 6]
  return heights.map((h, i) => `M${10 + i * 10} ${40 - h / 2} V${40 + h / 2}`).join(' ')
}

// Equaliser: columns of stacked blocks.
function equaliserPath() {
  const columns = [3, 5, 4, 7, 6, 8, 5, 3]
  const blocks = []
  columns.forEach((count, col) => {
    for (let i = 0; i < count; i++) {
      const x = 6 + col * 12
      const y = 94 - (i + 1) * 10
      blocks.push(`M${x} ${y} h9 v7 h-9 Z`)
    }
  })
  return blocks.join(' ')
}

// Hand-drawn loop: almost two laps of a tilted oval that shrinks a little, so both laps
// stay outside the box it circles.
function scribblePath() {
  const points = []
  const laps = 1.85
  const steps = 90
  const tilt = (-6 * Math.PI) / 180
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const a = Math.PI * 1.1 + t * laps * Math.PI * 2
    const shrink = 1 - 0.13 * t
    const x = Math.cos(a) * 48 * shrink
    const y = Math.sin(a) * 46 * shrink
    points.push(`${(50 + x * Math.cos(tilt) - y * Math.sin(tilt)).toFixed(1)} ${(50 + x * Math.sin(tilt) + y * Math.cos(tilt)).toFixed(1)}`)
  }
  return `M${points.join(' L')}`
}

// Starburst outline with `spikes` points; `stretchX` widens it into an oval.
function burstPath(cx, cy, outer, inner, spikes, stretchX = 1) {
  const points = []
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outer : inner
    const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2
    points.push(`${(cx + Math.cos(a) * r * stretchX).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)}`)
  }
  return `M${points.join(' L')} Z`
}

/**
 * @typedef {'primary' | 'accent' | 'ink' | 'paper'} Slot
 * @typedef {{ d?: string, circle?: number[], text?: string, label?: boolean, x?: number,
 *   y?: number, size?: number, font?: string, rotate?: number, maxWidth?: number,
 *   fill?: Slot, stroke?: Slot, width?: number }} ElementPart
 * @typedef {{ mode: 'behind' | 'around' | 'under' | 'corner' | 'side' | 'sideLeft',
 *   pad?: number[], rotate?: number, clearsText?: boolean }} ElementFit
 * @typedef {{ id: string, name: string, category: string, viewBox: number[],
 *   colors: { primary: string, accent: string }, parts: ElementPart[], fit?: ElementFit,
 *   text?: string, opacity?: number, shadow?: boolean }} ElementSpec
 */

/** @type {ElementSpec[]} */
export const ELEMENTS = [
  // ── With the headline ──────────────────────────────────────────────────────
  {
    id: 'brush-banner',
    name: 'Brush stroke',
    category: 'headline',
    fit: { mode: 'behind', pad: [0.35, 0.2] },
    viewBox: [200, 70],
    colors: { primary: '#FF1F6B', accent: '#FFFFFF' },
    parts: [
      {
        d: 'M8 16 C40 6 120 4 194 10 L186 22 L197 32 L188 44 L195 58 C130 66 60 64 5 62 L14 50 L3 40 L12 28 Z',
        fill: 'primary',
      },
      { d: 'M30 67 C80 70 130 69 170 66', stroke: 'primary', width: 2 },
    ],
  },
  {
    id: 'torn-paper',
    name: 'Torn paper',
    category: 'headline',
    fit: { mode: 'behind', pad: [0.3, 0.3] },
    viewBox: [200, 66],
    colors: { primary: '#FFFFFF', accent: '#111111' },
    shadow: true,
    parts: [
      {
        d: 'M4 10 L20 4 L36 9 L52 3 L70 8 L88 2 L104 8 L122 3 L140 9 L158 4 L176 9 L196 5 L193 33 L198 60 L180 64 L162 59 L144 65 L126 60 L108 66 L90 60 L72 65 L54 59 L36 65 L18 60 L2 64 L6 36 Z',
        fill: 'primary',
      },
    ],
  },
  {
    id: 'pill',
    name: 'Pill',
    category: 'headline',
    fit: { mode: 'behind', pad: [0.45, 0.15] },
    viewBox: [200, 60],
    colors: { primary: '#111111', accent: '#FFE600' },
    parts: [{ d: 'M30 4 H170 A26 26 0 0 1 170 56 H30 A26 26 0 0 1 30 4 Z', fill: 'primary', stroke: 'accent', width: 3 }],
  },
  {
    id: 'slant-box',
    name: 'Slanted box',
    category: 'headline',
    fit: { mode: 'behind', pad: [0.35, 0.12] },
    viewBox: [200, 60],
    colors: { primary: '#FFE600', accent: '#111111' },
    parts: [
      { d: 'M26 8 H198 L184 58 H12 Z', fill: 'accent' },
      { d: 'M18 2 H190 L176 52 H4 Z', fill: 'primary' },
    ],
  },
  {
    id: 'burst-back',
    name: 'Burst',
    category: 'headline',
    fit: { mode: 'behind', pad: [0.55, 0.9] },
    viewBox: [200, 120],
    colors: { primary: '#FF1F6B', accent: '#FFE600' },
    parts: [
      { d: burstPath(100, 60, 58, 44, 16, 1.66), fill: 'primary', stroke: 'ink', width: 3 },
    ],
  },
  {
    id: 'hand-box',
    name: 'Hand-drawn box',
    category: 'headline',
    fit: { mode: 'around', pad: [0.25, 0.3] },
    viewBox: [200, 60],
    colors: { primary: '#FFFFFF', accent: '#FFE600' },
    parts: [
      {
        d: 'M8 8 C60 3 140 5 194 7 C197 26 196 42 193 54 C130 58 60 57 7 53 C4 38 5 22 9 4 M4 12 C50 9 120 10 190 11',
        stroke: 'primary',
        width: 3,
      },
    ],
  },
  {
    id: 'brackets',
    name: 'Corner brackets',
    category: 'headline',
    fit: { mode: 'around', pad: [0.2, 0.2] },
    viewBox: [200, 60],
    colors: { primary: '#FFE600', accent: '#FFFFFF' },
    parts: [{ d: 'M4 20 V4 H24 M176 4 H196 V20 M196 40 V56 H176 M24 56 H4 V40', stroke: 'primary', width: 4 }],
  },
  {
    id: 'zigzag-underline',
    name: 'Zigzag underline',
    category: 'headline',
    fit: { mode: 'under' },
    viewBox: [200, 30],
    colors: { primary: '#00E5FF', accent: '#FFFFFF' },
    parts: [{ d: 'M4 20 L20 8 L36 20 L52 8 L68 20 L84 8 L100 20 L116 8 L132 20 L148 8 L164 20 L180 8 L196 20', stroke: 'primary', width: 5 }],
  },
  {
    id: 'tape',
    name: 'Tape',
    category: 'headline',
    fit: { mode: 'corner', rotate: 35 },
    viewBox: [80, 28],
    colors: { primary: '#FFF3B0', accent: '#FFFFFF' },
    opacity: 0.85,
    parts: [{ d: 'M3 5 L10 2 L70 1 L77 4 L75 14 L78 24 L70 27 L8 26 L2 23 L5 14 Z', fill: 'primary' }],
  },

  // ── Reactions ──────────────────────────────────────────────────────────────
  {
    id: 'scribble-circle',
    name: 'Scribble circle',
    category: 'headline',
    fit: { mode: 'around', pad: [0.75, 1] },
    viewBox: [100, 100],
    colors: { primary: '#FF1F1F', accent: '#FFFFFF' },
    parts: [
      {
        d: scribblePath(),
        stroke: 'primary',
        width: 3.5,
      },
    ],
  },
  {
    id: 'underline',
    name: 'Underline swoosh',
    category: 'headline',
    fit: { mode: 'under' },
    viewBox: [200, 60],
    colors: { primary: '#FFE600', accent: '#FFFFFF' },
    parts: [
      { d: 'M8 30 C60 14 130 12 192 22', stroke: 'primary', width: 9 },
      { d: 'M30 46 C80 36 130 36 170 40', stroke: 'primary', width: 6 },
    ],
  },
  {
    id: 'highlighter',
    name: 'Highlighter',
    category: 'headline',
    fit: { mode: 'behind', pad: [0.2, 0.05] },
    viewBox: [200, 60],
    colors: { primary: '#FFE600', accent: '#FFFFFF' },
    opacity: 0.7,
    parts: [{ d: 'M6 14 L190 8 L196 46 L10 52 L14 34 Z', fill: 'primary' }],
  },
  {
    id: 'exclamation',
    name: 'Exclamation',
    category: 'reaction',
    fit: { mode: 'side' },
    viewBox: [60, 100],
    colors: { primary: '#FF1F1F', accent: '#FFFFFF' },
    parts: [
      { d: 'M16 6 L46 6 L38 66 L24 66 Z', fill: 'primary', stroke: 'ink', width: 4 },
      { circle: [31, 84, 10], fill: 'primary', stroke: 'ink', width: 4 },
    ],
  },
  {
    id: 'question',
    name: 'Question mark',
    category: 'reaction',
    viewBox: [80, 100],
    colors: { primary: '#FFE600', accent: '#FFFFFF' },
    parts: [
      { d: 'M16 32 C16 8 64 4 64 30 C64 46 42 48 40 64', stroke: 'ink', width: 20 },
      { circle: [40, 86, 11], fill: 'ink' },
      { d: 'M16 32 C16 8 64 4 64 30 C64 46 42 48 40 64', stroke: 'primary', width: 12 },
      { circle: [40, 86, 7], fill: 'primary' },
    ],
  },
  {
    id: 'interrobang',
    name: '?!',
    category: 'reaction',
    viewBox: [120, 100],
    colors: { primary: '#FFE600', accent: '#FF1F1F' },
    parts: [
      { d: 'M14 32 C14 8 60 4 60 30 C60 46 40 48 38 64', stroke: 'ink', width: 20 },
      { circle: [38, 86, 11], fill: 'ink' },
      { d: 'M14 32 C14 8 60 4 60 30 C60 46 40 48 38 64', stroke: 'primary', width: 12 },
      { circle: [38, 86, 7], fill: 'primary' },
      { d: 'M78 6 L106 6 L99 66 L85 66 Z', fill: 'accent', stroke: 'ink', width: 4 },
      { circle: [92, 84, 10], fill: 'accent', stroke: 'ink', width: 4 },
    ],
  },
  {
    id: 'shock-lines',
    name: 'Shock lines',
    category: 'reaction',
    viewBox: [120, 80],
    colors: { primary: '#FFFFFF', accent: '#FFE600' },
    parts: [
      { d: 'M14 60 L34 48 M8 36 L30 34 M18 12 L36 24', stroke: 'primary', width: 6 },
      { d: 'M106 60 L86 48 M112 36 L90 34 M102 12 L84 24', stroke: 'primary', width: 6 },
    ],
  },
  {
    id: 'sweat-drop',
    name: 'Sweat drop',
    category: 'reaction',
    viewBox: [60, 90],
    colors: { primary: '#4FC3F7', accent: '#FFFFFF' },
    parts: [
      { d: 'M30 6 C30 6 52 40 52 58 A22 22 0 0 1 8 58 C8 40 30 6 30 6 Z', fill: 'primary', stroke: 'ink', width: 4 },
      { d: 'M18 56 C18 48 22 42 26 36', stroke: 'accent', width: 5 },
    ],
  },
  {
    id: 'anger',
    name: 'Anger mark',
    category: 'reaction',
    viewBox: [100, 100],
    colors: { primary: '#FF1F1F', accent: '#FFFFFF' },
    parts: [
      {
        d: 'M38 14 Q38 38 14 38 M62 14 Q62 38 86 38 M38 86 Q38 62 14 62 M62 86 Q62 62 86 62',
        stroke: 'primary',
        width: 10,
      },
    ],
  },
  {
    id: 'pointer-arrow',
    name: 'Pointing arrow',
    category: 'reaction',
    fit: { mode: 'sideLeft' },
    viewBox: [100, 100],
    colors: { primary: '#FFFFFF', accent: '#FFE600' },
    parts: [
      { d: 'M10 84 C24 30 64 14 86 38', stroke: 'primary', width: 6 },
      { d: 'M71 34 L87 40 L88 23', stroke: 'primary', width: 6 },
    ],
  },
  {
    id: 'loop-arrow',
    name: 'Loop arrow',
    category: 'reaction',
    viewBox: [140, 80],
    colors: { primary: '#FFFFFF', accent: '#FFE600' },
    parts: [
      { d: 'M8 60 C30 64 48 58 56 44 C64 28 48 16 40 30 C32 46 60 60 90 54 C108 50 120 42 130 32', stroke: 'primary', width: 5 },
      { d: 'M116 30 L131 31 L127 46', stroke: 'primary', width: 5 },
    ],
  },
  {
    id: 'sparkle',
    name: 'Sparkle',
    category: 'reaction',
    fit: { mode: 'corner' },
    viewBox: [100, 100],
    colors: { primary: '#FFE600', accent: '#FFFFFF' },
    parts: [
      { d: 'M50 4 C54 38 62 46 96 50 C62 54 54 62 50 96 C46 62 38 54 4 50 C38 46 46 38 50 4 Z', fill: 'primary', stroke: 'ink', width: 3 },
      { d: 'M80 10 C81 18 82 19 90 20 C82 21 81 22 80 30 C79 22 78 21 70 20 C78 19 79 18 80 10 Z', fill: 'accent' },
    ],
  },
  {
    id: 'heart',
    name: 'Heart',
    category: 'reaction',
    viewBox: [100, 90],
    colors: { primary: '#FF1F6B', accent: '#FFFFFF' },
    parts: [
      { d: 'M50 84 C20 64 4 46 12 26 C20 8 44 8 50 26 C56 8 80 8 88 26 C96 46 80 64 50 84 Z', fill: 'primary', stroke: 'ink', width: 4 },
      { d: 'M24 30 C26 22 32 18 38 18', stroke: 'accent', width: 5 },
    ],
  },

  // ── Debate ─────────────────────────────────────────────────────────────────
  {
    id: 'vs-badge',
    name: 'VS badge',
    category: 'versus',
    viewBox: [120, 120],
    colors: { primary: '#FF1F1F', accent: '#FFE600' },
    text: 'VS',
    parts: [
      { d: burstPath(60, 60, 56, 44, 14), fill: 'primary', stroke: 'ink', width: 4 },
      { text: 'VS', label: true, x: 60, y: 76, size: 46, fill: 'accent', stroke: 'ink', width: 5, font: BOLD_FONT, maxWidth: 84 },
    ],
  },
  {
    id: 'lightning',
    name: 'Lightning divider',
    category: 'versus',
    viewBox: [60, 200],
    colors: { primary: '#FFE600', accent: '#FFFFFF' },
    parts: [{ d: 'M36 2 L8 96 L30 96 L14 198 L54 78 L32 78 L50 2 Z', fill: 'primary', stroke: 'ink', width: 4 }],
  },
  {
    id: 'speech',
    name: 'Speech bubble',
    category: 'versus',
    // Behind the headline the bubble holds it; its own text starts empty then.
    fit: { mode: 'behind', pad: [0.35, 0.45], clearsText: true },
    viewBox: [120, 100],
    colors: { primary: '#FFFFFF', accent: '#111111' },
    text: 'WHAT?!',
    parts: [
      {
        d: 'M16 8 H104 Q114 8 114 18 V60 Q114 70 104 70 H52 L28 94 L34 70 H16 Q6 70 6 60 V18 Q6 8 16 8 Z',
        fill: 'primary',
        stroke: 'ink',
        width: 4,
      },
      { text: 'WHAT?!', label: true, x: 60, y: 50, size: 26, fill: 'accent', font: BOLD_FONT, maxWidth: 96 },
    ],
  },
  {
    id: 'thought',
    name: 'Thought bubble',
    category: 'versus',
    fit: { mode: 'behind', pad: [0.45, 0.75], clearsText: true },
    viewBox: [120, 100],
    colors: { primary: '#FFFFFF', accent: '#111111' },
    text: 'HMM…',
    parts: [
      { circle: [34, 40, 22], fill: 'primary', stroke: 'ink', width: 4 },
      { circle: [60, 30, 26], fill: 'primary', stroke: 'ink', width: 4 },
      { circle: [88, 40, 22], fill: 'primary', stroke: 'ink', width: 4 },
      { circle: [60, 52, 24], fill: 'primary', stroke: 'ink', width: 4 },
      { circle: [24, 80, 7], fill: 'primary', stroke: 'ink', width: 4 },
      { circle: [12, 94, 4], fill: 'primary', stroke: 'ink', width: 3 },
      { text: 'HMM…', label: true, x: 60, y: 50, size: 22, fill: 'accent', font: BOLD_FONT, maxWidth: 80 },
    ],
  },
  {
    id: 'quote',
    name: 'Quote marks',
    category: 'versus',
    viewBox: [100, 80],
    colors: { primary: '#FFE600', accent: '#FFFFFF' },
    parts: [
      { d: 'M8 70 V44 Q8 14 38 6 L42 16 Q26 24 26 38 H42 V70 Z', fill: 'primary', stroke: 'ink', width: 3 },
      { d: 'M54 70 V44 Q54 14 84 6 L88 16 Q72 24 72 38 H88 V70 Z', fill: 'primary', stroke: 'ink', width: 3 },
    ],
  },
  {
    id: 'check',
    name: 'Check',
    category: 'versus',
    viewBox: [100, 100],
    colors: { primary: '#22C55E', accent: '#FFFFFF' },
    parts: [
      { d: 'M14 54 L40 80 L88 20', stroke: 'ink', width: 22 },
      { d: 'M14 54 L40 80 L88 20', stroke: 'primary', width: 13 },
    ],
  },
  {
    id: 'cross',
    name: 'Cross',
    category: 'versus',
    viewBox: [100, 100],
    colors: { primary: '#EF4444', accent: '#FFFFFF' },
    parts: [
      { d: 'M20 20 L80 80 M80 20 L20 80', stroke: 'ink', width: 22 },
      { d: 'M20 20 L80 80 M80 20 L20 80', stroke: 'primary', width: 13 },
    ],
  },
  {
    id: 'scale',
    name: 'Scales',
    category: 'versus',
    viewBox: [120, 100],
    colors: { primary: '#FFFFFF', accent: '#FFE600' },
    parts: [
      { d: 'M60 10 V88 M38 90 H82 M16 26 H104', stroke: 'primary', width: 5 },
      { d: 'M16 26 L4 58 H28 Z M104 26 L92 58 H116 Z', stroke: 'primary', width: 4 },
      { d: 'M2 58 Q16 72 30 58 Z M90 58 Q104 72 118 58 Z', fill: 'accent', stroke: 'primary', width: 3 },
      { circle: [60, 10, 5], fill: 'accent' },
    ],
  },

  // ── Podcast ────────────────────────────────────────────────────────────────
  {
    id: 'microphone',
    name: 'Microphone',
    category: 'podcast',
    viewBox: [100, 100],
    colors: { primary: '#FFFFFF', accent: '#FF1F6B' },
    parts: [
      { d: 'M36 20 A14 14 0 0 1 64 20 V46 A14 14 0 0 1 36 46 Z', fill: 'accent', stroke: 'primary', width: 5 },
      { d: 'M38 26 H48 M38 34 H48 M52 26 H62 M52 34 H62', stroke: 'primary', width: 3 },
      { d: 'M24 44 A26 26 0 0 0 76 44 M50 70 V86 M34 88 H66', stroke: 'primary', width: 6 },
    ],
  },
  {
    id: 'headphones',
    name: 'Headphones',
    category: 'podcast',
    viewBox: [100, 100],
    colors: { primary: '#FFFFFF', accent: '#00E5FF' },
    parts: [
      { d: 'M16 64 V54 A34 34 0 0 1 84 54 V64', stroke: 'primary', width: 7 },
      { d: 'M14 58 H28 V90 H14 Q8 90 8 84 V64 Q8 58 14 58 Z', fill: 'accent', stroke: 'primary', width: 4 },
      { d: 'M72 58 H86 Q92 58 92 64 V84 Q92 90 86 90 H72 Z', fill: 'accent', stroke: 'primary', width: 4 },
    ],
  },
  {
    id: 'waveform',
    name: 'Waveform',
    category: 'podcast',
    viewBox: [210, 80],
    colors: { primary: '#00E5FF', accent: '#FFFFFF' },
    parts: [{ d: waveformPath(), stroke: 'primary', width: 5 }],
  },
  {
    id: 'equaliser',
    name: 'Equaliser',
    category: 'podcast',
    viewBox: [104, 100],
    colors: { primary: '#76FF03', accent: '#FF3D00' },
    parts: [{ d: equaliserPath(), fill: 'primary' }],
  },
  {
    id: 'on-air',
    name: 'On air',
    category: 'podcast',
    viewBox: [160, 60],
    colors: { primary: '#FF1F1F', accent: '#FFFFFF' },
    text: 'ON AIR',
    parts: [
      { d: 'M14 6 H146 Q154 6 154 14 V46 Q154 54 146 54 H14 Q6 54 6 46 V14 Q6 6 14 6 Z', fill: 'primary', stroke: 'ink', width: 3 },
      { circle: [28, 30, 7], fill: 'accent' },
      { text: 'ON AIR', label: true, x: 90, y: 43, size: 36, fill: 'accent', font: BOLD_FONT, maxWidth: 104 },
    ],
  },
  {
    id: 'live',
    name: 'Live',
    category: 'podcast',
    viewBox: [120, 56],
    colors: { primary: '#FF1F1F', accent: '#FFFFFF' },
    text: 'LIVE',
    parts: [
      { d: 'M10 6 H110 Q116 6 116 12 V44 Q116 50 110 50 H10 Q4 50 4 44 V12 Q4 6 10 6 Z', fill: 'primary' },
      { circle: [24, 28, 7], fill: 'accent' },
      { text: 'LIVE', label: true, x: 70, y: 41, size: 34, fill: 'accent', font: BOLD_FONT, maxWidth: 76 },
    ],
  },
  {
    id: 'new-burst',
    name: 'NEW sticker',
    category: 'podcast',
    viewBox: [120, 120],
    colors: { primary: '#FFE600', accent: '#111111' },
    text: 'NEW',
    parts: [
      { d: burstPath(60, 60, 56, 48, 18), fill: 'primary', stroke: 'ink', width: 3 },
      { text: 'NEW', label: true, x: 60, y: 74, size: 40, fill: 'accent', font: BOLD_FONT, maxWidth: 84, rotate: -10 },
    ],
  },
  {
    id: 'episode',
    name: 'Episode badge',
    category: 'podcast',
    viewBox: [110, 110],
    colors: { primary: '#111111', accent: '#FFE600' },
    text: 'EP 42',
    parts: [
      { circle: [55, 55, 50], fill: 'primary', stroke: 'accent', width: 5 },
      { circle: [55, 55, 41], stroke: 'accent', width: 2 },
      { text: 'EP 42', label: true, x: 55, y: 68, size: 34, fill: 'accent', font: BOLD_FONT, maxWidth: 74 },
    ],
  },
]

export function findElement(id) {
  return ELEMENTS.find((e) => e.id === id)
}

export function elementsByCategory() {
  return ELEMENT_CATEGORIES.map((category) => ({
    ...category,
    elements: ELEMENTS.filter((e) => e.category === category.id),
  }))
}
