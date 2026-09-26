import type { LayoutPreset, SlotLayout } from '../../types/thumbnail'
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './canvasSize'

export const MAX_SPEAKERS = 4

const PORTRAIT_WIDTH = 720
const PORTRAIT_HEIGHT = 1280

const portraitTextStyle: LayoutPreset['textStyleAndPosition'] = {
  fontFamily: 'Montserrat', fontSize: 62, fontWeight: '900', textAlign: 'center',
  fillColor: '#FFFFFF', strokeColor: '#000000', strokeWidth: 6,
  shadowColor: 'rgba(0, 0, 0, 0.9)', shadowBlur: 16, shadowOffsetX: 3, shadowOffsetY: 5,
  transform: { x: PORTRAIT_WIDTH / 2, y: 90, scaleX: 1, scaleY: 1, rotation: 0 }, visible: true,
}

const PORTRAIT_LAYOUTS: LayoutPreset[] = [
  { id: 'portrait-solo-spotlight', name: 'Solo Spotlight', description: 'One large speaker beneath a bold title', speakerCount: 1,
    slots: [{ transform: { x: 360, y: 850, scaleX: 1.15, scaleY: 1.15, rotation: 0 }, frame: { centerX: 360, centerY: 800, personHeight: 1000 } }], textStyleAndPosition: portraitTextStyle },
  { id: 'portrait-stacked-duo', name: 'Stacked Duo', description: 'Two speakers arranged top and bottom for portrait video', speakerCount: 2,
    slots: [320, 930].map((y) => ({ transform: { x: 360, y, scaleX: 0.76, scaleY: 0.76, rotation: 0 }, frame: { centerX: 360, centerY: y, personHeight: 570 } })), textStyleAndPosition: portraitTextStyle },
  { id: 'portrait-three-up', name: 'Three-Up Panel', description: 'Three speakers in a vertical stack', speakerCount: 3,
    slots: [280, 650, 1020].map((y) => ({ transform: { x: 360, y, scaleX: 0.58, scaleY: 0.58, rotation: 0 }, frame: { centerX: 360, centerY: y, personHeight: 390 } })), textStyleAndPosition: portraitTextStyle },
  { id: 'portrait-four-grid', name: 'Four-Corner Grid', description: 'Four speakers in a compact two-by-two grid', speakerCount: 4,
    slots: [{ x: 205, y: 440 }, { x: 515, y: 440 }, { x: 205, y: 900 }, { x: 515, y: 900 }].map(({ x, y }) => ({ transform: { x, y, scaleX: 0.48, scaleY: 0.48, rotation: 0 }, frame: { centerX: x, centerY: y, personHeight: 340 } })), textStyleAndPosition: portraitTextStyle },
]

// Auto-frame targets before layouts existed: 27% / 73% of width, 60% down, person
// filling 1.05x canvas height. The three original two-speaker layouts keep them.
const FRAME_CENTER_Y = CANVAS_HEIGHT * 0.6
const TWO_SPEAKER_PERSON_HEIGHT = CANVAS_HEIGHT * 1.05

function slot(x: number, y: number, scale: number, personHeight: number, rotation = 0): SlotLayout {
  return {
    transform: { x, y, scaleX: scale, scaleY: scale, rotation, flipX: false },
    frame: { centerX: x, centerY: FRAME_CENTER_Y, personHeight },
  }
}

function withFrameX(s: SlotLayout, centerX: number): SlotLayout {
  return { ...s, frame: { ...s.frame, centerX } }
}

const BOLD_YELLOW_TEXT: LayoutPreset['textStyleAndPosition'] = {
  fontFamily: 'Montserrat',
  fontSize: 70,
  fontWeight: '900',
  textAlign: 'center',
  fillColor: '#FACC15',
  strokeColor: '#000000',
  strokeWidth: 6,
  shadowColor: 'rgba(0, 0, 0, 0.9)',
  shadowBlur: 16,
  shadowOffsetX: 4,
  shadowOffsetY: 6,
  transform: { x: 640, y: 100, scaleX: 1, scaleY: 1, rotation: 0 },
  visible: true,
}

/** Evenly spaced slots: centre of slot i is at (2i+1)/(2n) of the canvas width. */
function evenSlots(count: number, scale: number, personHeight: number): SlotLayout[] {
  return Array.from({ length: count }, (_, i) =>
    slot(Math.round((CANVAS_WIDTH * (2 * i + 1)) / (2 * count)), 440, scale, personHeight)
  )
}

/**
 * All layouts, in menu order. The first layout for each speaker count is its default.
 * To add a layout, append an object here — nothing else needs to change.
 */
export const LAYOUT_PRESETS: LayoutPreset[] = [
  {
    id: 'solo-centre',
    name: 'Solo Centre',
    description: 'One speaker centred and large, headline across the top',
    speakerCount: 1,
    slots: [slot(640, 430, 1.05, CANVAS_HEIGHT * 1.1)],
    textStyleAndPosition: BOLD_YELLOW_TEXT,
  },
  {
    id: 'side-by-side',
    name: 'Dual Speaker Debate',
    description: 'Balanced side-by-side layout with bold centered headline',
    speakerCount: 2,
    slots: [
      withFrameX(slot(320, 440, 0.9, TWO_SPEAKER_PERSON_HEIGHT), CANVAS_WIDTH * 0.27),
      withFrameX(slot(960, 440, 0.9, TWO_SPEAKER_PERSON_HEIGHT), CANVAS_WIDTH * 0.73),
    ],
    textStyleAndPosition: BOLD_YELLOW_TEXT,
  },
  {
    id: 'host-guest-spotlight',
    name: 'Host & Guest Spotlight',
    description: 'Prominent guest on right, host on left with angled headline',
    speakerCount: 2,
    slots: [
      withFrameX(slot(260, 460, 0.8, TWO_SPEAKER_PERSON_HEIGHT, -3), CANVAS_WIDTH * 0.27),
      withFrameX(slot(980, 410, 1.05, TWO_SPEAKER_PERSON_HEIGHT, 2), CANVAS_WIDTH * 0.73),
    ],
    textStyleAndPosition: {
      fontFamily: 'Bebas Neue',
      fontSize: 84,
      fontWeight: 'bold',
      textAlign: 'center',
      fillColor: '#FFFFFF',
      strokeColor: '#DC2626',
      strokeWidth: 5,
      shadowColor: 'rgba(0, 0, 0, 0.85)',
      shadowBlur: 14,
      shadowOffsetX: 3,
      shadowOffsetY: 5,
      transform: { x: 640, y: 110, scaleX: 1, scaleY: 1, rotation: 0 },
      visible: true,
    },
  },
  {
    id: 'dramatic-clash',
    name: 'Dramatic Clash',
    description: 'Overlapping centered speakers with high-impact uppercase headline',
    speakerCount: 2,
    slots: [
      withFrameX(slot(440, 430, 0.95, TWO_SPEAKER_PERSON_HEIGHT, -4), CANVAS_WIDTH * 0.27),
      withFrameX(slot(840, 430, 0.95, TWO_SPEAKER_PERSON_HEIGHT, 4), CANVAS_WIDTH * 0.73),
    ],
    textStyleAndPosition: {
      fontFamily: 'Montserrat',
      fontSize: 76,
      fontWeight: '900',
      textAlign: 'center',
      fillColor: '#38BDF8',
      strokeColor: '#0F172A',
      strokeWidth: 6,
      shadowColor: 'rgba(0, 0, 0, 0.9)',
      shadowBlur: 20,
      shadowOffsetX: 4,
      shadowOffsetY: 8,
      transform: { x: 640, y: 95, scaleX: 1, scaleY: 1, rotation: 0 },
      visible: true,
    },
  },
  {
    id: 'panel-of-three',
    name: 'Panel of Three',
    description: 'Three speakers in equal thirds',
    speakerCount: 3,
    slots: evenSlots(3, 0.7, CANVAS_HEIGHT * 0.95),
    textStyleAndPosition: BOLD_YELLOW_TEXT,
  },
  {
    id: 'panel-of-four',
    name: 'Panel of Four',
    description: 'Four speakers in equal quarters; neighbours overlap slightly',
    speakerCount: 4,
    slots: evenSlots(4, 0.55, CANVAS_HEIGHT * 0.85),
    textStyleAndPosition: BOLD_YELLOW_TEXT,
  },
]

export function getLayoutsForCount(count: number, portrait = false): LayoutPreset[] {
  return (portrait ? PORTRAIT_LAYOUTS : LAYOUT_PRESETS).filter((l) => l.speakerCount === count)
}

export function getDefaultLayout(count: number, portrait = false): LayoutPreset {
  const layout = getLayoutsForCount(count, portrait)[0]
  if (!layout) throw new Error(`No layout for ${count} speakers`)
  return layout
}

export function getLayout(id: string): LayoutPreset | undefined {
  return [...LAYOUT_PRESETS, ...PORTRAIT_LAYOUTS].find((l) => l.id === id)
}

const POSITION_LABELS: Record<number, string[]> = {
  1: ['Centre'],
  2: ['Left', 'Right'],
  3: ['Left', 'Centre', 'Right'],
  4: ['Left', 'Centre-left', 'Centre-right', 'Right'],
}

export function positionLabels(count: number): string[] {
  return POSITION_LABELS[count] ?? Array.from({ length: count }, (_, i) => `Position ${i + 1}`)
}
