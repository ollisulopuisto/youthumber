import { describe, it, expect, vi } from 'vitest'
import {
  COMMANDS,
  commandsFor,
  barCommands,
  paletteCommands,
  commandForShortcut,
  isCommandEnabled,
  searchCommands,
  matchScore,
  stepLayerOrder,
  layerKind,
  type CommandContext,
} from '../modules/commands/commands'
import { SHORTCUTS, getShortcut } from '../modules/shortcuts/shortcuts'
import {
  createDefaultProject,
  createTextLayer,
  addTextLayer,
  createBug,
  addBug,
  addSticker,
  nudgeLayer,
} from '../modules/thumbnail/thumbnailState'
import type { SpeakerState, StickerState, ThumbnailProject } from '../types/thumbnail'

const updateSpeaker = (p: ThumbnailProject, id: string, change: (s: SpeakerState) => SpeakerState) => ({
  ...p,
  speakers: p.speakers.map((s) => (s.id === id ? change(s) : s)),
})

const sticker = (id: string, elementId: string): StickerState => ({
  id,
  elementId,
  colors: { primary: '#f00', accent: '#ff0' },
  lineWeight: 1,
  outline: 0,
  outlineColor: '#fff',
  shadow: false,
  opacity: 1,
  visible: true,
  x: 100,
  y: 100,
  width: 200,
  height: 100,
  rotation: 0,
})

/** A project with one of everything: two speakers (the first with a photo), a text, a logo, two elements. */
function fullProject(): ThumbnailProject {
  let p = createDefaultProject('T')
  p = addTextLayer(p, { ...createTextLayer(p, 'txt_a') })
  p = addBug(p, createBug(p, 'data:,', 'Logo', 100, 50, 'bug_a'))
  p = addSticker(p, sticker('stk_fit', 'brush-banner'), true)
  p = addSticker(p, sticker('stk_plain', 'question'))
  p = {
    ...p,
    speakers: p.speakers.map((s, i) => (i === 0 ? { ...s, sourceImageUrl: 'data:,photo' } : s)),
  }
  return p
}

const ids = (commands: { id: string }[]) => commands.map((c) => c.id)

describe('commandsFor', () => {
  const p = fullProject()
  const [host, guest] = p.speakers

  it('lets the headline be edited and moved, but not deleted or duplicated', () => {
    const list = ids(commandsFor('text', p))
    expect(list).toContain('editText')
    expect(list).toContain('bringForward')
    expect(list).not.toContain('delete')
    expect(list).not.toContain('duplicate')
  })

  it('offers edit, duplicate and delete on an extra text', () => {
    expect(ids(commandsFor('txt_a', p))).toEqual(
      expect.arrayContaining(['editText', 'duplicate', 'delete', 'properties'])
    )
  })

  it('offers duplicate, delete and flip on a logo', () => {
    const list = ids(commandsFor('bug_a', p))
    expect(list).toEqual(expect.arrayContaining(['duplicate', 'delete', 'flip']))
    expect(list).not.toContain('editText')
  })

  it('offers fit to headline only for elements that fit it, and one of behind / in front', () => {
    const fit = ids(commandsFor('stk_fit', p))
    expect(fit).toContain('fitToHeadline')
    expect(fit).toContain('inFrontOfText')
    expect(fit).not.toContain('behindText')
    const plain = ids(commandsFor('stk_plain', p))
    expect(plain).not.toContain('fitToHeadline')
    expect(plain).toContain('behindText')
    expect(plain).not.toContain('inFrontOfText')
  })

  it('offers remove background until the speaker has a cutout, then auto-frame and reset mask', () => {
    const before = ids(commandsFor(host.id, p))
    expect(before).toEqual(expect.arrayContaining(['removeBackground', 'flip', 'resetPosition']))
    expect(before).not.toContain('autoFrame')
    expect(before).not.toContain('delete')

    const cut = updateSpeaker(p, host.id, (s) => ({ ...s, cutoutUrl: 'data:,cut', maskUrl: 'data:,mask' }))
    const after = ids(commandsFor(host.id, cut))
    expect(after).not.toContain('removeBackground')
    expect(after).toEqual(expect.arrayContaining(['autoFrame', 'resetMask']))
  })

  it('offers no photo commands on an empty speaker slot', () => {
    const list = ids(commandsFor(guest.id, p))
    expect(list).not.toContain('removeBackground')
    expect(list).not.toContain('flip')
    expect(list).toContain('resetPosition')
  })

  it('has only properties and ordering for the graphics layer, and only properties for the background', () => {
    expect(ids(commandsFor('decor', p))).toEqual(['bringForward', 'sendBackward', 'properties'])
    expect(ids(commandsFor('background', p))).toEqual(['properties'])
  })

  it('has nothing without a selection, or for a layer that is gone', () => {
    expect(commandsFor(null, p)).toEqual([])
    expect(commandsFor('stk_gone', p)).toEqual([])
  })

  it('greys out remove background while it runs, and fit while the headline is hidden', () => {
    const busy = updateSpeaker(p, host.id, (s) => ({ ...s, isProcessing: true }))
    const remove = COMMANDS.find((c) => c.id === 'removeBackground')!
    expect(isCommandEnabled(remove, { layerId: host.id, project: p })).toBe(true)
    expect(isCommandEnabled(remove, { layerId: host.id, project: busy })).toBe(false)
    const fit = COMMANDS.find((c) => c.id === 'fitToHeadline')!
    const hidden = { ...p, text: { ...p.text, visible: false } }
    expect(isCommandEnabled(fit, { layerId: 'stk_fit', project: hidden })).toBe(false)
  })
})

describe('barCommands', () => {
  const p = fullProject()

  it('shows at most four commands plus More… (properties)', () => {
    for (const layerId of ['text', 'txt_a', 'bug_a', 'stk_fit', 'stk_plain', p.speakers[0].id]) {
      const bar = barCommands(layerId, p)
      expect(bar.length).toBeLessThanOrEqual(5)
      expect(bar.at(-1)!.id).toBe('properties')
    }
  })

  it('picks the commands for each kind of layer', () => {
    expect(ids(barCommands('text', p))).toEqual(['editText', 'properties'])
    expect(ids(barCommands('txt_a', p))).toEqual(['editText', 'duplicate', 'delete', 'properties'])
    expect(ids(barCommands('bug_a', p))).toEqual(['duplicate', 'delete', 'flip', 'properties'])
    expect(ids(barCommands('stk_fit', p))).toEqual(['duplicate', 'delete', 'fitToHeadline', 'inFrontOfText', 'properties'])
    expect(ids(barCommands(p.speakers[0].id, p))).toEqual(['removeBackground', 'flip', 'resetPosition', 'properties'])
  })

  it('has no bar for the graphics layer, the background or no selection', () => {
    expect(barCommands('decor', p)).toEqual([])
    expect(barCommands('background', p)).toEqual([])
    expect(barCommands(null, p)).toEqual([])
  })
})

describe('paletteCommands', () => {
  const p = fullProject()

  it('lists the selection first, then the app, and never the key-only ones', () => {
    const list = ids(paletteCommands('bug_a', p))
    expect(list.indexOf('delete')).toBeLessThan(list.indexOf('save'))
    expect(list).toEqual(expect.arrayContaining(['undo', 'redo', 'save', 'export', 'projects', 'help', 'deselect']))
    expect(list).not.toContain('nudge')
    expect(list).not.toContain('palette')
  })

  it('offers the app commands without a selection, but not deselect', () => {
    const list = ids(paletteCommands(null, p))
    expect(list).toEqual(['undo', 'redo', 'addText', 'addElement', 'save', 'export', 'projects', 'help'])
  })

  it('greys out undo and redo when there is nothing to undo or redo', () => {
    const undo = commandForShortcut('undo')!
    expect(isCommandEnabled(undo, { layerId: null, project: p, canUndo: false })).toBe(false)
    expect(isCommandEnabled(undo, { layerId: null, project: p, canUndo: true })).toBe(true)
  })
})

describe('shortcuts and commands', () => {
  it('names a registered shortcut in every command that has a key', () => {
    for (const command of COMMANDS) {
      if (command.shortcutId) expect(getShortcut(command.shortcutId)).toBeDefined()
    }
  })

  it('runs exactly one command for every shortcut', () => {
    for (const shortcut of SHORTCUTS) {
      expect(COMMANDS.filter((c) => c.shortcutId === shortcut.id)).toHaveLength(1)
    }
  })

  it('gives every command its own id', () => {
    expect(new Set(ids(COMMANDS)).size).toBe(COMMANDS.length)
  })
})

describe('running commands', () => {
  const ctx = (overrides: Partial<CommandContext>): CommandContext =>
    new Proxy({ layerId: null, project: fullProject(), ...overrides } as CommandContext, {
      get: (target, key) => (key in target ? target[key as keyof CommandContext] : vi.fn()),
    })

  it('moves the selection 1 px with an arrow and 10 px with Shift', () => {
    const nudge = vi.fn()
    commandForShortcut('nudge')!.run(ctx({ layerId: 'bug_a', key: 'ArrowLeft', nudge }))
    commandForShortcut('nudgeFar')!.run(ctx({ layerId: 'bug_a', key: 'ArrowDown', nudge }))
    expect(nudge).toHaveBeenNthCalledWith(1, 'bug_a', -1, 0)
    expect(nudge).toHaveBeenNthCalledWith(2, 'bug_a', 0, 10)
  })

  it('reorders the layers one step with bring forward and send backward', () => {
    const project = fullProject()
    const reorderLayers = vi.fn()
    commandForShortcut('bringForward')!.run(ctx({ layerId: 'stk_fit', project, reorderLayers }))
    // It sat just behind the headline; one step forward puts it just in front.
    const order = reorderLayers.mock.calls[0][0]
    expect(order.indexOf('stk_fit')).toBe(order.indexOf('text') + 1)
  })
})

describe('stepLayerOrder', () => {
  const order = ['background', 'decor', 'spk_a', 'text', 'stk_a']

  it('swaps with the neighbour above or below', () => {
    expect(stepLayerOrder(order, 'spk_a', 1)).toEqual(['background', 'decor', 'text', 'spk_a', 'stk_a'])
    expect(stepLayerOrder(order, 'spk_a', -1)).toEqual(['background', 'spk_a', 'decor', 'text', 'stk_a'])
  })

  it('stops at the top, above the background, and for unknown layers', () => {
    expect(stepLayerOrder(order, 'stk_a', 1)).toBeNull()
    expect(stepLayerOrder(order, 'decor', -1)).toBeNull()
    expect(stepLayerOrder(order, 'background', 1)).toBeNull()
    expect(stepLayerOrder(order, 'nope', 1)).toBeNull()
  })

  it('places the graphics layer of older projects before stepping', () => {
    expect(stepLayerOrder(['background', 'spk_a', 'text'], 'spk_a', -1)).toEqual(['background', 'spk_a', 'decor', 'text'])
  })
})

describe('nudgeLayer', () => {
  const p = fullProject()

  it('moves each kind of layer', () => {
    const host = p.speakers[0]
    expect(nudgeLayer(p, host.id, 1, 0).speakers[0].transform.x).toBe(host.transform.x + 1)
    expect(nudgeLayer(p, 'text', 0, -10).text.transform.y).toBe(p.text.transform.y - 10)
    expect(nudgeLayer(p, 'txt_a', 10, 0).textLayers![0].transform.x).toBe(p.textLayers![0].transform.x + 10)
    expect(nudgeLayer(p, 'bug_a', 0, 1).bugs![0].y).toBe(p.bugs![0].y + 1)
    expect(nudgeLayer(p, 'stk_plain', -1, 0).stickers![1].x).toBe(99)
  })

  it('leaves the graphics layer and the background alone', () => {
    expect(nudgeLayer(p, 'decor', 1, 1)).toBe(p)
    expect(nudgeLayer(p, 'background', 1, 1)).toBe(p)
  })
})

describe('layerKind', () => {
  it('tells the layers apart', () => {
    const p = fullProject()
    expect(layerKind('text', p)).toBe('headline')
    expect(layerKind('txt_a', p)).toBe('text')
    expect(layerKind('bug_a', p)).toBe('bug')
    expect(layerKind('stk_fit', p)).toBe('sticker')
    expect(layerKind(p.speakers[1].id, p)).toBe('speaker')
    expect(layerKind('decor', p)).toBe('decor')
    expect(layerKind('spk_gone', p)).toBeNull()
  })
})

describe('searchCommands', () => {
  const all = paletteCommands('stk_fit', fullProject())

  it('lists everything, in order, for an empty query', () => {
    expect(searchCommands(all, '  ')).toEqual(all)
  })

  it('puts the label that starts with the query first', () => {
    expect(searchCommands(all, 'del')[0].id).toBe('delete')
    expect(searchCommands(all, 'EXP')[0].id).toBe('export')
  })

  it('finds scattered letters in order, ignoring spaces', () => {
    expect(ids(searchCommands(all, 'fth'))).toContain('fitToHeadline')
    expect(ids(searchCommands(all, 'in fr'))[0]).toBe('inFrontOfText')
  })

  it('finds commands by other words, after label matches', () => {
    expect(ids(searchCommands(all, 'download'))).toEqual(['export'])
    expect(ids(searchCommands(all, 'mirror'))).toEqual(['flip'])
  })

  it('finds nothing for letters that are not there', () => {
    expect(searchCommands(all, 'zzq')).toEqual([])
  })

  it('scores a run of letters above the same letters scattered', () => {
    expect(matchScore('Redo', 'red')!).toBeGreaterThan(matchScore('Remove background', 'rbg')!)
    expect(matchScore('Save project', 'proj')!).toBeGreaterThan(matchScore('Open projects', 'oprj')!)
    expect(matchScore('Undo', 'x')).toBeNull()
  })
})
