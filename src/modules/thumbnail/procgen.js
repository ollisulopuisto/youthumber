/**
 * Procedural backgrounds: seeded, palette-driven, plain canvas 2D, so they work in the
 * web build as well as the desktop app. Same seed + colours + size = same picture.
 *
 * colors[0] is the dark base, colors[1] the accent, colors[2] (optional) a second accent.
 */

/** Small fast seeded PRNG: () => float in [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Seeded 2D value noise, smooth, in [0, 1]. Coordinates are in lattice cells. */
export function valueNoise(seed) {
  const hash = (x, y) => {
    let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed | 0, 1274126177)) | 0
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296
  }
  const fade = (t) => t * t * (3 - 2 * t)
  return (x, y) => {
    const x0 = Math.floor(x)
    const y0 = Math.floor(y)
    const fx = fade(x - x0)
    const fy = fade(y - y0)
    const top = hash(x0, y0) * (1 - fx) + hash(x0 + 1, y0) * fx
    const bottom = hash(x0, y0 + 1) * (1 - fx) + hash(x0 + 1, y0 + 1) * fx
    return top * (1 - fy) + bottom * fy
  }
}

/** Three octaves of value noise, still in [0, 1]. */
function fbm(noise, x, y) {
  return (noise(x, y) * 4 + noise(x * 2.1 + 5.2, y * 2.1 + 1.3) * 2 + noise(x * 4.3 + 9.1, y * 4.3 + 7.7)) / 7
}

export function hexToRgb(hex) {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Colour at t (0..1) along the palette, as [r, g, b]. */
export function paletteAt(colors, t) {
  const rgb = colors.map(hexToRgb)
  if (rgb.length === 1) return rgb[0]
  const x = Math.min(Math.max(t, 0), 1) * (rgb.length - 1)
  const i = Math.min(Math.floor(x), rgb.length - 2)
  const f = x - i
  return rgb[i].map((c, k) => Math.round(c + (rgb[i + 1][k] - c) * f))
}

const css = ([r, g, b], a = 1) => `rgba(${r},${g},${b},${a})`
const accentAt = (colors, i) => colors[1 + (i % Math.max(colors.length - 1, 1))] ?? colors[0]
const fill = (ctx, w, h, color) => {
  ctx.fillStyle = color
  ctx.fillRect(0, 0, w, h)
}

/** Shared dark gradient base so no style sits on a flat slab. */
function base(ctx, w, h, colors) {
  const g = ctx.createLinearGradient(0, 0, w, h)
  g.addColorStop(0, css(paletteAt([colors[0], '#000000'], 0.0)))
  g.addColorStop(1, css(paletteAt([colors[0], '#000000'], 0.45)))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
}

/** Per-pixel styles compute at reduced size, then scale up smoothly. */
function pixelPass(ctx, w, h, makeCanvas, maxSide, shade) {
  const s = Math.min(1, maxSide / Math.max(w, h))
  const lw = Math.max(1, Math.round(w * s))
  const lh = Math.max(1, Math.round(h * s))
  const small = makeCanvas(lw, lh)
  const sctx = small.getContext('2d')
  const img = sctx.createImageData(lw, lh)
  const d = img.data
  for (let y = 0; y < lh; y++) {
    for (let x = 0; x < lw; x++) {
      const [r, g, b] = shade(x / lw, y / lh, lw, lh)
      const o = (y * lw + x) * 4
      d[o] = r
      d[o + 1] = g
      d[o + 2] = b
      d[o + 3] = 255
    }
  }
  sctx.putImageData(img, 0, 0)
  if ('imageSmoothingEnabled' in ctx || ctx.imageSmoothingEnabled === undefined) ctx.imageSmoothingEnabled = true
  ctx.drawImage(small, 0, 0, w, h)
}

const mix = (a, b, t) => a.map((c, k) => Math.round(c + (b[k] - c) * t))

const GENERATORS = {
  /** Soft overlapping colour blobs: the YouTube-gradient look. */
  mesh(ctx, w, h, colors, rand) {
    fill(ctx, w, h, colors[0])
    const n = 5 + Math.floor(rand() * 3)
    for (let i = 0; i < n; i++) {
      const x = rand() * w
      const y = rand() * h
      const r = (0.18 + rand() * 0.28) * Math.max(w, h)
      // Every third blob is a deep tint, so the accent never floods the frame.
      const c = hexToRgb(i % 3 === 2 ? mixHex('#000000', colors[0], 0.8) : mixHex(colors[0], accentAt(colors, i), 0.55 + rand() * 0.45))
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, css(c, 0.9))
      g.addColorStop(1, css(c, 0))
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
    }
  },

  /** Jittered triangle mesh in palette steps, like a faceted crystal. */
  lowpoly(ctx, w, h, colors, rand) {
    const cols = 9 + Math.floor(rand() * 4)
    const rows = Math.round(cols * (h / w)) + 1
    const cw = w / cols
    const ch = h / rows
    const pts = []
    for (let r = 0; r <= rows; r++) {
      pts[r] = []
      for (let c = 0; c <= cols; c++) {
        const edge = r === 0 || c === 0 || r === rows || c === cols
        pts[r][c] = [
          c * cw + (edge && (c === 0 || c === cols) ? 0 : (rand() - 0.5) * cw * 0.8),
          r * ch + (edge && (r === 0 || r === rows) ? 0 : (rand() - 0.5) * ch * 0.8),
        ]
      }
    }
    const pal = [colors[0], accentAt(colors, 0), colors[2] ?? colors[1]]
    const tri = (a, b, c) => {
      const cx = (a[0] + b[0] + c[0]) / 3 / w
      const cy = (a[1] + b[1] + c[1]) / 3 / h
      const t = Math.min(1, Math.max(0, 0.5 * cx + 0.4 * (1 - cy) + (rand() - 0.5) * 0.18 - 0.05))
      ctx.fillStyle = css(paletteAt(pal, t * t))
      ctx.strokeStyle = ctx.fillStyle
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(a[0], a[1])
      ctx.lineTo(b[0], b[1])
      ctx.lineTo(c[0], c[1])
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const [tl, tr, bl, br] = [pts[r][c], pts[r][c + 1], pts[r + 1][c], pts[r + 1][c + 1]]
        if (rand() < 0.5) {
          tri(tl, tr, bl)
          tri(tr, br, bl)
        } else {
          tri(tl, tr, br)
          tri(tl, br, bl)
        }
      }
    }
  },

  /** Topographic map: iso-lines of a noise landscape. */
  contours(ctx, w, h, colors, rand, { seed, makeCanvas }) {
    const noise = valueNoise(seed)
    const scale = 2.2 + rand() * 1.8
    const levels = 14
    const ox = rand() * 100
    const oy = rand() * 100
    const dark = hexToRgb(colors[0])
    const line = hexToRgb(accentAt(colors, 0))
    const glow = mix(dark, line, 0.12)
    pixelPass(ctx, w, h, makeCanvas, 960, (u, v, lw, lh) => {
      const f = (x, y) => fbm(noise, ox + (x / lw) * scale * (w / h), oy + (y / lh) * scale) * levels
      const x = u * lw
      const y = v * lh
      const band = Math.floor(f(x, y))
      const edge = band !== Math.floor(f(x + 2, y)) || band !== Math.floor(f(x, y + 2))
      if (edge) return mix(dark, line, band % 4 === 0 ? 1 : 0.65)
      return mix(dark, glow, (band / levels) * 1.4)
    })
  },

  /** Flow field: thousands of fine curved strokes. */
  flow(ctx, w, h, colors, rand, { seed }) {
    base(ctx, w, h, colors)
    const noise = valueNoise(seed)
    const scale = 1.6 + rand() * 1.4
    const pal = [colors[1], colors[2] ?? colors[1], '#FFFFFF']
    ctx.lineCap = 'round'
    const count = Math.round((w * h) / 520)
    for (let i = 0; i < count; i++) {
      let x = rand() * w
      let y = rand() * h
      const c = paletteAt(pal, rand() * rand())
      ctx.strokeStyle = css(c, 0.08 + rand() * 0.2)
      ctx.lineWidth = (0.5 + rand() * 1.8) * (w / 1920 + 0.4)
      ctx.beginPath()
      ctx.moveTo(x, y)
      for (let s = 0; s < 36; s++) {
        const a = fbm(noise, (x / w) * scale * (w / h), (y / h) * scale) * Math.PI * 4
        x += Math.cos(a) * (w / 240)
        y += Math.sin(a) * (w / 240)
        ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
  },

  /** Concentric rings around one or two centres, like a radar or ripple. */
  rings(ctx, w, h, colors, rand) {
    base(ctx, w, h, colors)
    const centres = [[rand() * w, rand() * h]]
    if (rand() < 0.6) centres.push([rand() * w, rand() * h])
    centres.forEach(([cx, cy], k) => {
      const step = (0.03 + rand() * 0.03) * Math.max(w, h)
      const max = Math.hypot(w, h)
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, max * 0.5)
      glow.addColorStop(0, css(hexToRgb(accentAt(colors, k)), 0.35))
      glow.addColorStop(1, css(hexToRgb(accentAt(colors, k)), 0))
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, w, h)
      for (let r = step, i = 0; r < max; r += step, i++) {
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.strokeStyle = css(hexToRgb(accentAt(colors, k + i)), Math.max(0.05, 0.7 - r / max))
        ctx.lineWidth = Math.max(1, step * (0.08 + 0.12 * rand()))
        ctx.stroke()
      }
    })
  },

  /** Truchet tiles: quarter-arc pairs that knit into flowing curves. */
  truchet(ctx, w, h, colors, rand) {
    base(ctx, w, h, colors)
    const size = h / (5 + Math.floor(rand() * 4))
    const cols = Math.ceil(w / size)
    const rows = Math.ceil(h / size)
    ctx.lineCap = 'butt'
    ctx.lineWidth = size * 0.22
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * size
        const y = r * size
        ctx.strokeStyle = css(hexToRgb(accentAt(colors, (r + c + (rand() < 0.2 ? 1 : 0)))), 0.85)
        ctx.beginPath()
        if (rand() < 0.5) {
          ctx.arc(x, y, size / 2, 0, Math.PI / 2)
          ctx.moveTo(x + size, y + size / 2)
          ctx.arc(x + size, y + size, size / 2, Math.PI, Math.PI * 1.5)
        } else {
          ctx.arc(x + size, y, size / 2, Math.PI / 2, Math.PI)
          ctx.moveTo(x + size / 2, y + size)
          ctx.arc(x, y + size, size / 2, Math.PI * 1.5, Math.PI * 2)
        }
        ctx.stroke()
      }
    }
  },

  /** Layered sine hills, lightest at the back. */
  waves(ctx, w, h, colors, rand) {
    const sky = ctx.createLinearGradient(0, 0, 0, h)
    sky.addColorStop(0, colors[0])
    sky.addColorStop(1, mixHex(colors[0], accentAt(colors, 0), 0.45))
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, w, h)
    const layers = 5 + Math.floor(rand() * 3)
    for (let i = 0; i < layers; i++) {
      const t = i / (layers - 1)
      const y0 = h * (0.3 + t * 0.6)
      const amp = h * (0.05 + rand() * 0.08)
      const f1 = 1 + rand() * 2.5
      const f2 = 2 + rand() * 4
      const p1 = rand() * Math.PI * 2
      const p2 = rand() * Math.PI * 2
      ctx.beginPath()
      ctx.moveTo(0, h)
      for (let x = 0; x <= w; x += w / 96) {
        const u = x / w
        ctx.lineTo(x, y0 + Math.sin(u * Math.PI * f1 + p1) * amp + Math.sin(u * Math.PI * f2 + p2) * amp * 0.4)
      }
      ctx.lineTo(w, h)
      ctx.closePath()
      ctx.fillStyle = css(paletteAt([accentAt(colors, 0), colors[2] ?? colors[0], colors[0]], 0.15 + t * 0.85), 0.55 + t * 0.4)
      ctx.fill()
    }
  },

  /** Voronoi cells: flat stained-glass facets with dark seams. */
  voronoi(ctx, w, h, colors, rand, { makeCanvas }) {
    const n = 28 + Math.floor(rand() * 20)
    const sites = Array.from({ length: n }, () => ({
      x: rand(),
      y: rand(),
      t: rand(),
    }))
    const dark = hexToRgb(colors[0])
    const pal = [colors[0], accentAt(colors, 0), colors[2] ?? colors[1]]
    const aspect = w / h
    pixelPass(ctx, w, h, makeCanvas, 640, (u, v) => {
      let best = Infinity
      let second = Infinity
      let owner = sites[0]
      for (const s of sites) {
        const d = Math.hypot((s.x - u) * aspect, s.y - v)
        if (d < best) {
          second = best
          best = d
          owner = s
        } else if (d < second) second = d
      }
      const cell = paletteAt(pal, owner.t * owner.t * 0.9 + 0.1 * (1 - v))
      return mix(dark, cell, Math.min(1, (second - best) * 70))
    })
  },
}

function mixHex(a, b, t) {
  const m = mix(hexToRgb(a), hexToRgb(b), t)
  return `#${m.map((c) => c.toString(16).padStart(2, '0')).join('')}`
}

export const PROCGEN_STYLES = [
  { id: 'mesh', name: 'Mesh glow' },
  { id: 'lowpoly', name: 'Low-poly' },
  { id: 'contours', name: 'Contours' },
  { id: 'flow', name: 'Flow lines' },
  { id: 'rings', name: 'Rings' },
  { id: 'truchet', name: 'Truchet' },
  { id: 'waves', name: 'Waves' },
  { id: 'voronoi', name: 'Facets' },
]

const browserCanvas = (width, height) => {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

/** Renders a style to a JPEG data URL. `makeCanvas` is injectable for tests. */
export function renderProcgen(id, { colors, seed, width, height, makeCanvas = browserCanvas }) {
  const generate = GENERATORS[id]
  if (!generate) throw new Error(`Unknown procedural style: ${id}`)
  const canvas = makeCanvas(width, height)
  const ctx = canvas.getContext('2d')
  generate(ctx, width, height, colors, mulberry32(seed * 7919 + 13), { seed, makeCanvas })
  return canvas.toDataURL('image/jpeg', 0.92)
}
