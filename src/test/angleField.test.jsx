import { createRoot } from 'react-dom/client'
import { act, createElement as h } from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import AngleField from '../components/ThumbnailEditor/AngleField'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
let container, root
afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function type(text) {
  const input = container.querySelector('input')
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  act(() => {
    setter.call(input, text)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  return input
}

describe('AngleField', () => {
  it('keeps a lone minus sign while typing a negative angle', () => {
    const onChange = vi.fn()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    act(() => root.render(h(AngleField, { value: 0, onChange, label: 'Rotation in degrees' })))
    expect(type('-').value).toBe('-')
    expect(onChange).not.toHaveBeenCalled()
    type('-45')
    expect(onChange).toHaveBeenLastCalledWith(-45)
  })

  it('clamps to the 180 degree range', () => {
    const onChange = vi.fn()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    act(() => root.render(h(AngleField, { value: 0, onChange, label: 'Rotation in degrees' })))
    type('400')
    expect(onChange).toHaveBeenLastCalledWith(180)
  })
})
