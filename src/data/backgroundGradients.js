/**
 * Preset gradients for the background. `angle` is in canvas terms (0 = left to right);
 * `type` defaults to linear.
 */

export const backgroundGradientPresets = [
  { id: 'midnight-blue', name: 'Midnight Blue', colors: ['#1E3A5F', '#0F1F3F'], angle: 135 },
  { id: 'espresso', name: 'Espresso', colors: ['#2C1810', '#1A0F08'], angle: 90 },
  { id: 'deep-space', name: 'Deep Space', colors: ['#0A0E27', '#1A1F3A'], angle: 180 },
  { id: 'neon-sunset', name: 'Neon Sunset', colors: ['#FF0080', '#7928CA'], angle: 135 },
  { id: 'cyber-teal', name: 'Cyber Teal', colors: ['#00C9A7', '#0D1B2A'], angle: 120 },
  { id: 'fire', name: 'Fire', colors: ['#FF3B1F', '#7A0C0C'], angle: 90 },
  { id: 'royal-gold', name: 'Royal Gold', colors: ['#D4AF37', '#1A140E'], angle: 135 },
  { id: 'cool-slate', name: 'Cool Slate', colors: ['#334155', '#0F172A'], angle: 180 },
  { id: 'spotlight', name: 'Spotlight', colors: ['#3F3F46', '#09090B'], angle: 0, type: 'radial' },
  { id: 'studio-blue', name: 'Studio Blue', colors: ['#1D4ED8', '#0B1026'], angle: 0, type: 'radial' },
  { id: 'warm-glow', name: 'Warm Glow', colors: ['#F59E0B', '#431407'], angle: 0, type: 'radial' },
  { id: 'mustard', name: 'Mustard', colors: ['#D6B53A', '#3A2A0A'], angle: 20 },
  { id: 'forest', name: 'Forest', colors: ['#166534', '#052E16'], angle: 135 },
  { id: 'ocean', name: 'Ocean', colors: ['#0EA5E9', '#1E3A8A'], angle: 60 },
  { id: 'crimson', name: 'Crimson', colors: ['#BE123C', '#1C0510'], angle: 45 },
  { id: 'violet-haze', name: 'Violet Haze', colors: ['#7C3AED', '#DB2777', '#F59E0B'], angle: 30 },
  // Loud: garish on their own, made to fight for attention in a feed
  { id: 'hazard', name: 'Hazard', colors: ['#FFE600', '#FF3D00'], angle: 110 },
  { id: 'acid', name: 'Acid', colors: ['#76FF03', '#00B8D4', '#6200EA'], angle: 135 },
  { id: 'hot-magenta', name: 'Hot Magenta', colors: ['#FF2EE6', '#FF1F6B', '#FF9F00'], angle: 45 },
  { id: 'electric', name: 'Electric', colors: ['#00E5FF', '#2979FF', '#0B0033'], angle: 0, type: 'radial' },
  { id: 'nuclear', name: 'Nuclear', colors: ['#EEFF41', '#1B5E20'], angle: 0, type: 'radial' },
  { id: 'lava', name: 'Lava', colors: ['#FF9F00', '#D50000', '#1A0000'], angle: 0, type: 'radial' },
]
