// The export asks before replacing a file, and says why when it could not save.
import { act, createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import ExportPromptModal from '../components/ThumbnailEditor/ExportPromptModal'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let root
let node

afterEach(() => {
  act(() => root?.unmount())
  node?.remove()
})

function show(props) {
  node = document.createElement('div')
  document.body.append(node)
  root = createRoot(node)
  act(() => root.render(h(ExportPromptModal, props)))
}
const button = (text) => [...document.querySelectorAll('button')].find((b) => b.textContent === text)

it('offers Replace, Keep both and Cancel, with Cancel focused so Enter never overwrites', () => {
  show({ kind: 'exists', path: '/Users/me/Downloads/thumb.jpg', onChoose: () => {} })
  expect(document.body.textContent).toContain('"thumb.jpg" already exists')
  expect(['Cancel', 'Keep both', 'Replace'].every((t) => button(t))).toBe(true)
  expect(document.activeElement).toBe(button('Cancel'))
})

it('reports the choice, and Escape means Cancel', () => {
  const onChoose = vi.fn()
  show({ kind: 'exists', path: '/d/thumb.jpg', onChoose })
  act(() => button('Replace').click())
  act(() => button('Keep both').click())
  act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))
  expect(onChoose.mock.calls.map((c) => c[0])).toEqual(['replace', 'keep', 'cancel'])
})

it('shows the failure reason', () => {
  show({ kind: 'error', message: 'Could not write /d/thumb.jpg: denied', onChoose: () => {} })
  expect(document.body.textContent).toContain('Export failed')
  expect(document.body.textContent).toContain('Could not write /d/thumb.jpg: denied')
})
