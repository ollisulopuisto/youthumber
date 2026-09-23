/**
 * Headline fonts offered in the studio's text panel. Every non-system font here must be
 * loaded in index.html in the listed weights — src/test/studioFonts.test.ts checks it.
 * To add a font: add it to the Google Fonts link in index.html, then add it here.
 */
export const STUDIO_FONTS = [
  // Bold & condensed — the usual YouTube thumbnail faces
  { family: 'Montserrat', category: 'Bold & condensed', weights: [400, 700, 800, 900] },
  { family: 'Bebas Neue', category: 'Bold & condensed', weights: [400] },
  { family: 'Anton', category: 'Bold & condensed', weights: [400] },
  { family: 'Oswald', category: 'Bold & condensed', weights: [400, 700] },
  { family: 'Archivo Black', category: 'Bold & condensed', weights: [400] },
  { family: 'League Spartan', category: 'Bold & condensed', weights: [400, 700, 900] },
  { family: 'Barlow Condensed', category: 'Bold & condensed', weights: [400, 700] },
  { family: 'Roboto Condensed', category: 'Bold & condensed', weights: [400, 700] },
  { family: 'Impact', category: 'Bold & condensed', weights: [400], system: true },
  // Sans-serif
  { family: 'Inter', category: 'Sans-serif', weights: [400, 700, 900] },
  { family: 'Poppins', category: 'Sans-serif', weights: [400, 700, 900] },
  { family: 'Rubik', category: 'Sans-serif', weights: [400, 700, 900] },
  { family: 'Nunito', category: 'Sans-serif', weights: [400, 700] },
  { family: 'Space Grotesk', category: 'Sans-serif', weights: [400, 700] },
  { family: 'Jost', category: 'Sans-serif', weights: [400, 700] },
  { family: 'Rajdhani', category: 'Sans-serif', weights: [400, 700] },
  // Serif
  { family: 'Playfair Display', category: 'Serif', weights: [400, 700] },
  { family: 'DM Serif Display', category: 'Serif', weights: [400] },
  { family: 'Abril Fatface', category: 'Serif', weights: [400] },
  { family: 'Bodoni Moda', category: 'Serif', weights: [400, 700] },
  { family: 'Cinzel', category: 'Serif', weights: [400, 700] },
  { family: 'Cormorant', category: 'Serif', weights: [400, 700] },
  { family: 'EB Garamond', category: 'Serif', weights: [400, 700] },
  { family: 'Lora', category: 'Serif', weights: [400, 700] },
  { family: 'Merriweather', category: 'Serif', weights: [400, 700] },
  { family: 'Libre Baskerville', category: 'Serif', weights: [400, 700] },
  // Fun
  { family: 'Bangers', category: 'Fun', weights: [400] },
  { family: 'Luckiest Guy', category: 'Fun', weights: [400] },
]

export function fontsByCategory() {
  const groups = []
  for (const font of STUDIO_FONTS) {
    let group = groups.find((g) => g.category === font.category)
    if (!group) groups.push((group = { category: font.category, fonts: [] }))
    group.fonts.push(font)
  }
  return groups
}

export function findStudioFont(family) {
  return STUDIO_FONTS.find((f) => f.family === family)
}

const NAMED_WEIGHTS = { normal: 400, bold: 700 }

/** The font's available weight closest to the requested one (ties go to the heavier). */
export function closestWeight(font, requested) {
  const target = NAMED_WEIGHTS[requested] ?? (Number(requested) || 400)
  return font.weights.reduce((best, w) =>
    Math.abs(w - target) < Math.abs(best - target) ||
    (Math.abs(w - target) === Math.abs(best - target) && w > best)
      ? w
      : best
  )
}
