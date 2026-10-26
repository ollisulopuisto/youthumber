/**
 * Everything the editor can do to a selection or a project, once. The keyboard, the
 * selection bar, the right-click menu and the command palette all list and run these, so
 * a command does the same thing, under the same name and key, wherever it is found.
 * The work itself is done by the editor's handlers, handed over in a CommandContext.
 */
import type { LayerId, ThumbnailProject } from '../../types/thumbnail'
import { nudgeOffset, type ShortcutId } from '../shortcuts/shortcuts'
import { getSpeaker, speakerLabel } from '../thumbnail/thumbnailState'
import { withDecorLayer } from '../thumbnail/decor'
import { findElement } from '../../data/elements'

/** What the editor knows when it decides which commands to offer. */
export interface CommandState {
  layerId: LayerId | null
  project: ThumbnailProject
  canUndo?: boolean
  canRedo?: boolean
}

/** The editor's handlers a command runs, plus the state it runs in. */
export interface CommandContext extends CommandState {
  /** The key that ran the command, for the arrow keys. */
  key?: string
  undo(): void
  redo(): void
  save(): void
  exportImage(): void
  openProjects(): void
  openHelp(): void
  openPalette(): void
  addText(): void
  addElement(): void
  deselect(): void
  editText(layerId: LayerId): void
  showProperties(layerId: LayerId): void
  duplicate(layerId: LayerId): void
  remove(layerId: LayerId): void
  fitToHeadline(layerId: LayerId): void
  setBehindText(layerId: LayerId, behind: boolean): void
  flip(layerId: LayerId): void
  resetPosition(layerId: LayerId): void
  resetMask(layerId: LayerId): void
  removeBackground(layerId: LayerId): void
  autoFrame(layerId: LayerId): void
  nudge(layerId: LayerId, dx: number, dy: number): void
  reorderLayers(order: LayerId[]): void
}

export interface Command {
  id: string
  label: string
  shortcutId?: ShortcutId
  /**
   * selection: acts on the selected layer; on the selection bar, right-click menu and palette.
   * app: in the palette only. key: only reached by its key (arrows, ⌘K), never listed.
   */
  scope: 'selection' | 'app' | 'key'
  /** One of the few the selection bar shows, in list order. */
  onBar?: boolean
  danger?: boolean
  /** Other words the palette finds it by. */
  keywords?: string
  appliesTo(layerId: LayerId | null, project: ThumbnailProject): boolean
  /** Offered but greyed out when false. */
  isEnabled?(state: CommandState): boolean
  run(ctx: CommandContext): void
}

export type LayerKind = 'speaker' | 'headline' | 'text' | 'bug' | 'sticker' | 'decor' | 'background'

export function layerKind(layerId: LayerId | null, project: ThumbnailProject): LayerKind | null {
  if (!layerId) return null
  if (layerId === 'text') return 'headline'
  if (layerId === 'decor') return 'decor'
  if (layerId === 'background') return 'background'
  if (project.textLayers?.some((t) => t.id === layerId)) return 'text'
  if (project.bugs?.some((b) => b.id === layerId)) return 'bug'
  if (project.stickers?.some((s) => s.id === layerId)) return 'sticker'
  if (getSpeaker(project, layerId)) return 'speaker'
  return null
}

/** The layer's name as the layers list shows it. */
export function layerLabel(layerId: LayerId, project: ThumbnailProject): string {
  switch (layerKind(layerId, project)) {
    case 'speaker':
      return speakerLabel(project, layerId)
    case 'headline':
      return 'Headline'
    case 'text':
      return project.textLayers?.find((t) => t.id === layerId)?.text.split('\n')[0].trim() || 'Text'
    case 'bug':
      return project.bugs?.find((b) => b.id === layerId)?.name || 'Logo'
    case 'sticker':
      return findElement(project.stickers?.find((s) => s.id === layerId)?.elementId)?.name ?? 'Element'
    case 'decor':
      return 'Graphics'
    case 'background':
      return 'Background'
    default:
      return ''
  }
}

const is =
  (...kinds: LayerKind[]) =>
  (layerId: LayerId | null, project: ThumbnailProject) =>
    kinds.includes(layerKind(layerId, project)!)

const speakerOf = (layerId: LayerId | null, project: ThumbnailProject) =>
  layerId ? getSpeaker(project, layerId) : undefined

const stickerOf = (layerId: LayerId | null, project: ThumbnailProject) =>
  project.stickers?.find((s) => s.id === layerId)

const isBehindText = (layerId: LayerId | null, project: ThumbnailProject) => {
  const order = project.layerOrder
  return order.indexOf(layerId!) < order.indexOf('text')
}

/**
 * The layer order with `layerId` swapped one place up (+1) or down (-1), or null when it
 * can't go further. Nothing goes below the background, which is drawn under everything.
 */
export function stepLayerOrder(layerOrder: LayerId[], layerId: LayerId, delta: 1 | -1): LayerId[] | null {
  const order = withDecorLayer(layerOrder) as LayerId[]
  const from = order.indexOf(layerId)
  const to = from + delta
  if (from < 0 || layerId === 'background' || to < 0 || to >= order.length || order[to] === 'background') {
    return null
  }
  const next = [...order]
  ;[next[from], next[to]] = [next[to], next[from]]
  return next
}

const nudge = (far: boolean) => (ctx: CommandContext) => {
  const offset = ctx.key ? nudgeOffset(ctx.key, far) : null
  if (offset && ctx.layerId) ctx.nudge(ctx.layerId, offset.dx, offset.dy)
}

const always = () => true
const movable = is('speaker', 'headline', 'text', 'bug', 'sticker')

/** In menu order. */
export const COMMANDS: Command[] = [
  {
    id: 'editText',
    label: 'Edit text',
    scope: 'selection',
    onBar: true,
    appliesTo: is('headline', 'text'),
    run: (ctx) => ctx.editText(ctx.layerId!),
  },
  {
    id: 'removeBackground',
    label: 'Remove background',
    scope: 'selection',
    onBar: true,
    keywords: 'cutout',
    appliesTo: (id, project) => {
      const speaker = speakerOf(id, project)
      return !!speaker?.sourceImageUrl && !speaker.cutoutUrl
    },
    isEnabled: ({ layerId, project }) => !speakerOf(layerId, project)?.isProcessing,
    run: (ctx) => ctx.removeBackground(ctx.layerId!),
  },
  {
    id: 'autoFrame',
    label: 'Auto-frame',
    scope: 'selection',
    onBar: true,
    appliesTo: (id, project) => !!speakerOf(id, project)?.cutoutUrl,
    run: (ctx) => ctx.autoFrame(ctx.layerId!),
  },
  {
    id: 'duplicate',
    label: 'Duplicate',
    shortcutId: 'duplicate',
    scope: 'selection',
    onBar: true,
    keywords: 'copy',
    appliesTo: is('text', 'bug', 'sticker'),
    run: (ctx) => ctx.duplicate(ctx.layerId!),
  },
  {
    id: 'delete',
    label: 'Delete',
    shortcutId: 'delete',
    scope: 'selection',
    onBar: true,
    danger: true,
    keywords: 'remove',
    appliesTo: is('text', 'bug', 'sticker'),
    run: (ctx) => ctx.remove(ctx.layerId!),
  },
  {
    id: 'fitToHeadline',
    label: 'Fit to headline',
    scope: 'selection',
    onBar: true,
    appliesTo: (id, project) => !!findElement(stickerOf(id, project)?.elementId)?.fit,
    isEnabled: ({ project }) => project.text.visible,
    run: (ctx) => ctx.fitToHeadline(ctx.layerId!),
  },
  {
    id: 'behindText',
    label: 'Behind text',
    scope: 'selection',
    onBar: true,
    appliesTo: (id, project) => !!stickerOf(id, project) && !isBehindText(id, project),
    run: (ctx) => ctx.setBehindText(ctx.layerId!, true),
  },
  {
    id: 'inFrontOfText',
    label: 'In front of text',
    scope: 'selection',
    onBar: true,
    appliesTo: (id, project) => !!stickerOf(id, project) && isBehindText(id, project),
    run: (ctx) => ctx.setBehindText(ctx.layerId!, false),
  },
  {
    id: 'flip',
    label: 'Flip',
    scope: 'selection',
    onBar: true,
    keywords: 'mirror',
    appliesTo: (id, project) =>
      is('bug', 'sticker')(id, project) || !!speakerOf(id, project)?.sourceImageUrl,
    run: (ctx) => ctx.flip(ctx.layerId!),
  },
  {
    id: 'resetPosition',
    label: 'Reset position',
    scope: 'selection',
    onBar: true,
    appliesTo: is('speaker'),
    run: (ctx) => ctx.resetPosition(ctx.layerId!),
  },
  {
    id: 'resetMask',
    label: 'Reset mask',
    scope: 'selection',
    appliesTo: (id, project) => {
      const speaker = speakerOf(id, project)
      return !!(speaker?.maskUrl || speaker?.cutoutUrl)
    },
    run: (ctx) => ctx.resetMask(ctx.layerId!),
  },
  {
    id: 'bringForward',
    label: 'Bring forward',
    shortcutId: 'bringForward',
    scope: 'selection',
    appliesTo: (id, project) => !!layerKind(id, project) && id !== 'background',
    isEnabled: ({ layerId, project }) => !!stepLayerOrder(project.layerOrder, layerId!, 1),
    run: (ctx) => {
      const order = stepLayerOrder(ctx.project.layerOrder, ctx.layerId!, 1)
      if (order) ctx.reorderLayers(order)
    },
  },
  {
    id: 'sendBackward',
    label: 'Send backward',
    shortcutId: 'sendBackward',
    scope: 'selection',
    appliesTo: (id, project) => !!layerKind(id, project) && id !== 'background',
    isEnabled: ({ layerId, project }) => !!stepLayerOrder(project.layerOrder, layerId!, -1),
    run: (ctx) => {
      const order = stepLayerOrder(ctx.project.layerOrder, ctx.layerId!, -1)
      if (order) ctx.reorderLayers(order)
    },
  },
  {
    id: 'properties',
    label: 'Properties…',
    scope: 'selection',
    keywords: 'settings more',
    appliesTo: (id, project) => !!layerKind(id, project),
    run: (ctx) => ctx.showProperties(ctx.layerId!),
  },
  { id: 'nudge', label: 'Move 1 px', shortcutId: 'nudge', scope: 'key', appliesTo: movable, run: nudge(false) },
  { id: 'nudgeFar', label: 'Move 10 px', shortcutId: 'nudgeFar', scope: 'key', appliesTo: movable, run: nudge(true) },
  {
    id: 'deselect',
    label: 'Deselect',
    shortcutId: 'deselect',
    scope: 'app',
    appliesTo: (id) => !!id,
    run: (ctx) => ctx.deselect(),
  },
  {
    id: 'undo',
    label: 'Undo',
    shortcutId: 'undo',
    scope: 'app',
    appliesTo: always,
    isEnabled: ({ canUndo }) => canUndo !== false,
    run: (ctx) => ctx.undo(),
  },
  {
    id: 'redo',
    label: 'Redo',
    shortcutId: 'redo',
    scope: 'app',
    appliesTo: always,
    isEnabled: ({ canRedo }) => canRedo !== false,
    run: (ctx) => ctx.redo(),
  },
  { id: 'addText', label: 'Add text', scope: 'app', keywords: 'new', appliesTo: always, run: (ctx) => ctx.addText() },
  {
    id: 'addElement',
    label: 'Add element…',
    scope: 'app',
    keywords: 'new sticker banner',
    appliesTo: always,
    run: (ctx) => ctx.addElement(),
  },
  {
    id: 'save',
    label: 'Save project',
    shortcutId: 'save',
    scope: 'app',
    appliesTo: always,
    run: (ctx) => ctx.save(),
  },
  {
    id: 'export',
    label: 'Export thumbnail',
    shortcutId: 'export',
    scope: 'app',
    keywords: 'download image jpg png',
    appliesTo: always,
    run: (ctx) => ctx.exportImage(),
  },
  {
    id: 'projects',
    label: 'Open projects…',
    shortcutId: 'projects',
    scope: 'app',
    keywords: 'gallery load',
    appliesTo: always,
    run: (ctx) => ctx.openProjects(),
  },
  { id: 'palette', label: 'Find a command', shortcutId: 'palette', scope: 'key', appliesTo: always, run: (ctx) => ctx.openPalette() },
  {
    id: 'help',
    label: 'Keyboard shortcuts',
    shortcutId: 'help',
    scope: 'app',
    keywords: 'help keys',
    appliesTo: always,
    run: (ctx) => ctx.openHelp(),
  },
]

/** What can be done to `layerId`: the right-click menu, in order. */
export function commandsFor(layerId: LayerId | null, project: ThumbnailProject): Command[] {
  return COMMANDS.filter((c) => c.scope === 'selection' && c.appliesTo(layerId, project))
}

const BAR_SLOTS = 4

/** The selection bar: a few of commandsFor(), then Properties ("More…"). Empty when the layer has none. */
export function barCommands(layerId: LayerId | null, project: ThumbnailProject): Command[] {
  const commands = commandsFor(layerId, project)
  const onBar = commands.filter((c) => c.onBar).slice(0, BAR_SLOTS)
  if (!onBar.length) return []
  return [...onBar, ...commands.filter((c) => c.id === 'properties')]
}

/** Everything the palette offers: the selection's commands, then the app's. */
export function paletteCommands(layerId: LayerId | null, project: ThumbnailProject): Command[] {
  return [
    ...commandsFor(layerId, project),
    ...COMMANDS.filter((c) => c.scope === 'app' && c.appliesTo(layerId, project)),
  ]
}

const byShortcut = new Map(COMMANDS.filter((c) => c.shortcutId).map((c) => [c.shortcutId!, c]))

export function commandForShortcut(id: ShortcutId): Command | undefined {
  return byShortcut.get(id)
}

export function isCommandEnabled(command: Command, state: CommandState): boolean {
  return command.isEnabled ? command.isEnabled(state) : true
}

/**
 * How well `query` matches `text`, higher is better, or null for no match. A run of the
 * query inside the text beats its letters scattered in order ("rbg" finds "Remove background").
 */
export function matchScore(text: string, query: string): number | null {
  const q = query.trim().toLowerCase()
  if (!q) return 0
  const t = text.toLowerCase()
  const at = t.indexOf(q)
  if (at >= 0) return 1000 - at + (at === 0 || t[at - 1] === ' ' ? 100 : 0)
  let score = 0
  let from = 0
  let last = -2
  for (const ch of q.replace(/\s+/g, '')) {
    const i = t.indexOf(ch, from)
    if (i < 0) return null
    if (i === last + 1) score += 3
    else if (i === 0 || t[i - 1] === ' ') score += 2
    last = i
    from = i + 1
  }
  return score
}

/** The palette's search: matching commands, best first, list order among equals. */
export function searchCommands(commands: Command[], query: string): Command[] {
  return commands
    .map((command, index) => {
      const label = matchScore(command.label, query)
      const keywords = command.keywords ? matchScore(command.keywords, query) : null
      // A label match beats a keyword match.
      const score = label ?? (keywords === null ? null : keywords - 2000)
      return { command, index, score }
    })
    .filter((r) => r.score !== null)
    .sort((a, b) => b.score! - a.score! || a.index - b.index)
    .map((r) => r.command)
}

/**
 * The index `step` (+1 or -1) away from `from` that the palette highlights next, wrapping at
 * the ends and skipping greyed-out commands. `from` when none is enabled.
 */
export function nextEnabledIndex(
  commands: Command[],
  from: number,
  step: 1 | -1,
  isEnabled: (command: Command) => boolean
): number {
  const n = commands.length
  for (let i = 1; i <= n; i++) {
    const index = (from + step * i + n * n) % n
    if (isEnabled(commands[index])) return index
  }
  return from
}
