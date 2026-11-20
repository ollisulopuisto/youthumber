import { createRoot } from 'react-dom/client'
import { act, createElement as h } from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import CropControls from '../components/ThumbnailEditor/CropControls'
import { createDefaultProject, setSpeakerCrop, addBug, updateBug, createBug } from '../modules/thumbnail/thumbnailState'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let container, root
afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function mount(crop, onChange) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root.render(h(CropControls, { crop, onChange })))
}

function slide(label, value) {
  const input = container.querySelector(`input[aria-label="${label}"]`)
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  act(() => {
    setter.call(input, String(value))
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

const resetButton = () => [...container.querySelectorAll('button')].find((b) => b.textContent === 'Reset crop')

describe('CropControls', () => {
  it('reports the edge the user moved, as a fraction', () => {
    const onChange = vi.fn()
    mount(undefined, onChange)
    slide('Crop left', 25)
    expect(onChange).toHaveBeenCalledWith({ left: 0.25, top: 0, right: 0, bottom: 0 })
  })

  it('keeps the other edges when one moves', () => {
    const onChange = vi.fn()
    mount({ left: 0.1, top: 0, right: 0, bottom: 0.2 }, onChange)
    slide('Crop top', 30)
    expect(onChange).toHaveBeenCalledWith({ left: 0.1, top: 0.3, right: 0, bottom: 0.2 })
  })

  it('disables Reset crop when nothing is cropped', () => {
    mount(undefined, vi.fn())
    expect(resetButton().disabled).toBe(true)
  })

  it('clears the crop with Reset crop', () => {
    const onChange = vi.fn()
    mount({ left: 0.2, top: 0, right: 0, bottom: 0 }, onChange)
    act(() => resetButton().click())
    expect(onChange).toHaveBeenCalledWith(undefined)
  })
})

describe('crop in project state', () => {
  it('sets, normalizes and clears a speaker crop', () => {
    const project = createDefaultProject('t', 2)
    const id = project.speakers[0].id
    const cropped = setSpeakerCrop(project, id, { left: 0.2, top: 0, right: 0.95, bottom: 0 })
    const { left, right } = cropped.speakers[0].crop
    expect(left + right).toBeLessThanOrEqual(0.9 + 1e-9)
    expect(cropped.speakers[1].crop).toBeUndefined()
    expect(setSpeakerCrop(cropped, id, undefined).speakers[0].crop).toBeUndefined()
  })

  it('stores a bug crop', () => {
    let project = createDefaultProject('t', 2)
    const bug = createBug ? createBug(project, 'data:image/png;base64,AA', 'logo', 100, 100) : null
    expect(bug).toBeTruthy()
    project = addBug(project, bug)
    project = updateBug(project, bug.id, { crop: { left: 0.1, top: 0, right: 0, bottom: 0 } })
    expect(project.bugs[0].crop.left).toBe(0.1)
  })
})
