export function shade(hex: string, amt: number): string {
  const h = String(hex).replace('#', '')
  const x = h.length === 3 ? h.replace(/./g, (c) => c + c) : h.padEnd(6, '0')
  const n = parseInt(x.slice(0, 6), 16)
  if (Number.isNaN(n)) return hex
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  const f = amt < 0 ? 1 + amt : 1 - amt
  if (amt < 0) {
    r = Math.round(r * f); g = Math.round(g * f); b = Math.round(b * f)
  } else {
    r = Math.round(r + (255 - r) * amt)
    g = Math.round(g + (255 - g) * amt)
    b = Math.round(b + (255 - b) * amt)
  }
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
}
