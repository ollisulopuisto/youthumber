/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { STUDIO_FONTS, closestWeight, fontsByCategory } from '../data/studioFonts'

const indexHtml = readFileSync(resolve(__dirname, '../../index.html'), 'utf8')

function loadedWeights(family: string): number[] | null {
  const param = family.replace(/ /g, '\\+')
  const match = indexHtml.match(new RegExp(`family=${param}(?::wght@([0-9;]+))?(?=&|")`))
  if (!match) return null
  return match[1] ? match[1].split(';').map(Number) : [400]
}

describe('studio fonts', () => {
  it('only offers fonts that index.html actually loads, in the weights it loads', () => {
    // The old picker offered Inter, which was never loaded, so it silently fell back.
    for (const font of STUDIO_FONTS.filter((f) => !f.system)) {
      const weights = loadedWeights(font.family)
      expect(weights, `${font.family} is not loaded in index.html`).not.toBeNull()
      for (const w of font.weights) {
        expect(weights, `${font.family} ${w} is not loaded`).toContain(w)
      }
    }
  })

  it('loads a real black (900) weight for the headline fonts the layouts use', () => {
    // Layout presets ask for Montserrat 900; only 400/700 were loaded, so it was faked.
    expect(loadedWeights('Montserrat')).toContain(900)
  })

  it('has no duplicate families', () => {
    const families = STUDIO_FONTS.map((f) => f.family)
    expect(new Set(families).size).toBe(families.length)
  })

  it('groups fonts by category, keeping list order', () => {
    const groups = fontsByCategory()
    expect(groups.map((g) => g.fonts.length).reduce((a, b) => a + b, 0)).toBe(STUDIO_FONTS.length)
    expect(groups[0].category).toBe(STUDIO_FONTS[0].category)
  })

  it('maps a requested weight to the closest one the font has', () => {
    const twoWeights = { family: 'X', category: 'Sans', weights: [400, 700] }
    expect(closestWeight(twoWeights, 900)).toBe(700)
    expect(closestWeight(twoWeights, 'bold')).toBe(700)
    expect(closestWeight(twoWeights, 'normal')).toBe(400)
    expect(closestWeight({ family: 'Y', category: 'Display', weights: [400] }, 900)).toBe(400)
  })
})
