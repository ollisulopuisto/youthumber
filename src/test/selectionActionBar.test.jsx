// "More…" on the selection bar used to scroll to a properties panel that is already on
// screen, so it looked dead. The bar now says where the button is, so the editor can open
// the object's full command list under it.
import { act, createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import SelectionActionBar from '../components/ThumbnailEditor/SelectionActionBar'
import { barCommands } from '../modules/commands/commands'
import { createDefaultProject } from '../modules/thumbnail/thumbnailState'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let root
let node

afterEach(() => {
  act(() => root?.unmount())
  node?.remove()
  document.body.innerHTML = ''
})

function renderBar(onRun) {
  const project = createDefaultProject('t', 2)
  const speaker = project.speakers[0]
  project.speakers[0] = { ...speaker, sourceImageUrl: 'a.png', cutoutUrl: 'b.png' }
  node = document.createElement('div')
  document.body.append(node)
  root = createRoot(node)
  act(() =>
    root.render(
      h(SelectionActionBar, {
        rect: { left: 100, top: 100, width: 200, height: 200 },
        viewportRef: { current: document.body },
        label: 'Left',
        commands: barCommands(speaker.id, project.speakers[0] && project),
        isEnabled: () => true,
        onRun,
      })
    )
  )
}

it('tells the editor where the More button is when it is clicked', () => {
  const onRun = vi.fn()
  renderBar(onRun)
  const more = [...document.querySelectorAll('button')].find((b) => b.textContent.startsWith('More'))
  expect(more).toBeTruthy()
  act(() => more.click())
  const [command, rect] = onRun.mock.calls[0]
  expect(command.id).toBe('properties')
  expect(rect).toEqual(expect.objectContaining({ left: expect.any(Number), bottom: expect.any(Number) }))
})
